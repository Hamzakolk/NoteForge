"""Two-way sync between local NoteForge notes and a 'NoteForge' folder on Google Drive.

Uses the drive.file scope: the app only sees files it created itself.
"""
import io
import json
import os
import threading
import time

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
FOLDER_NAME = "NoteForge"
HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT_FILE = os.path.join(HERE, "client_secret.json")
APP_DIR = os.path.join(os.path.expanduser("~"), ".noteforge")
TOKEN_FILE = os.path.join(APP_DIR, "token.json")
STATE_FILE = os.path.join(APP_DIR, "sync_state.json")
NOTES_DIR = os.path.join(APP_DIR, "notes")
NOTE_EXT = (".md", ".txt")


class DriveSync:
    def __init__(self):
        os.makedirs(NOTES_DIR, exist_ok=True)
        self.lock = threading.Lock()
        self.service = None
        self.folder_id = None
        self.state = self._load_state()
        self.last_result = ""

    # ----- state -----
    def _load_state(self):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def _save_state(self):
        os.makedirs(APP_DIR, exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    # ----- auth -----
    def connect(self):
        creds = None
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(CLIENT_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
            os.makedirs(APP_DIR, exist_ok=True)
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(creds.to_json())
        self.service = build("drive", "v3", credentials=creds, cache_discovery=False)
        self.folder_id = self._ensure_folder()

    def _ensure_folder(self):
        q = (f"name = '{FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' "
             "and trashed = false")
        found = self.service.files().list(q=q, fields="files(id)").execute().get("files", [])
        if found:
            return found[0]["id"]
        meta = {"name": FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"}
        return self.service.files().create(body=meta, fields="id").execute()["id"]

    # ----- helpers -----
    def _local_notes(self):
        return {n: os.path.getmtime(os.path.join(NOTES_DIR, n))
                for n in os.listdir(NOTES_DIR) if n.lower().endswith(NOTE_EXT)}

    def _remote_notes(self):
        out, token = {}, None
        while True:
            resp = self.service.files().list(
                q=f"'{self.folder_id}' in parents and trashed = false",
                fields="nextPageToken, files(id, name, modifiedTime)",
                pageToken=token).execute()
            for f in resp.get("files", []):
                out[f["name"]] = f
            token = resp.get("nextPageToken")
            if not token:
                return out

    @staticmethod
    def _mime(name):
        return "text/markdown" if name.lower().endswith(".md") else "text/plain"

    def _upload(self, name, file_id=None):
        path = os.path.join(NOTES_DIR, name)
        media = MediaFileUpload(path, mimetype=self._mime(name), resumable=False)
        if file_id:
            f = self.service.files().update(fileId=file_id, media_body=media,
                                            fields="id, modifiedTime").execute()
        else:
            f = self.service.files().create(body={"name": name, "parents": [self.folder_id]},
                                            media_body=media, fields="id, modifiedTime").execute()
        return f

    def _download(self, name, file_id):
        path = os.path.join(NOTES_DIR, name)
        request = self.service.files().get_media(fileId=file_id)
        with io.FileIO(path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return os.path.getmtime(path)

    # ----- sync -----
    def sync_once(self):
        with self.lock:
            if self.service is None:
                self.connect()
            local = self._local_notes()
            remote = self._remote_notes()
            up, down, conflicts = 0, 0, 0

            for name in sorted(set(local) | set(remote)):
                st = self.state.get(name, {})
                l_mtime = local.get(name)
                r = remote.get(name)

                if l_mtime is not None and r is None and name in self.state:
                    # it was synced before and is gone from Drive: deleted elsewhere
                    trash_local(name)
                    self.state.pop(name, None)
                    continue
                if l_mtime is None and r is not None and name in self.state:
                    # it was synced before and is gone locally: delete it on Drive too
                    self.service.files().update(fileId=r["id"], body={"trashed": True}).execute()
                    self.state.pop(name, None)
                    continue

                if l_mtime is not None and r is None:
                    f = self._upload(name, st.get("id") if st.get("id") else None)
                    self._record(name, f, os.path.getmtime(os.path.join(NOTES_DIR, name)))
                    up += 1
                elif r is not None and l_mtime is None:
                    mtime = self._download(name, r["id"])
                    self._record(name, r, mtime)
                    down += 1
                else:
                    local_changed = l_mtime > st.get("synced_mtime", 0) + 1
                    remote_changed = r["modifiedTime"] != st.get("drive_modified")
                    if local_changed and remote_changed:
                        # both changed: keep the Drive copy under a new name, push local
                        base, ext = os.path.splitext(name)
                        copy_name = f"{base}.conflict-{time.strftime('%Y%m%d-%H%M%S')}{ext}"
                        self._download(copy_name, r["id"])
                        f = self._upload(name, r["id"])
                        self._record(name, f, os.path.getmtime(os.path.join(NOTES_DIR, name)))
                        conflicts += 1
                    elif local_changed:
                        f = self._upload(name, r["id"])
                        self._record(name, f, l_mtime)
                        up += 1
                    elif remote_changed:
                        mtime = self._download(name, r["id"])
                        self._record(name, r, mtime)
                        down += 1

            self._save_state()
            self.last_result = f"uploaded {up}, downloaded {down}, conflicts {conflicts}"
            return self.last_result

    def reset_login(self):
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
        self.service = None
        self.folder_id = None

    def _record(self, name, f, local_mtime):
        self.state[name] = {"id": f["id"], "drive_modified": f.get("modifiedTime"),
                            "synced_mtime": local_mtime}

    # ----- auto sync -----
    def start_auto(self, interval=60, on_done=None):
        def loop():
            while True:
                try:
                    result = self.sync_once()
                except Exception as e:
                    result = f"sync error: {e}"
                if on_done:
                    on_done(result)
                time.sleep(interval)
        threading.Thread(target=loop, daemon=True).start()


TRASH_DIR = os.path.join(APP_DIR, "trash")


def trash_local(name):
    """Move a local note into the trash folder (kept on this PC only)."""
    os.makedirs(TRASH_DIR, exist_ok=True)
    src = os.path.join(NOTES_DIR, name)
    if os.path.exists(src):
        os.replace(src, os.path.join(TRASH_DIR, f"{int(time.time())}_{name}"))


def save_note(name, text):
    os.makedirs(NOTES_DIR, exist_ok=True)
    with open(os.path.join(NOTES_DIR, name), "w", encoding="utf-8") as f:
        f.write(text)


if __name__ == "__main__":
    s = DriveSync()
    print("sync:", s.sync_once())
