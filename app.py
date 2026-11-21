import base64
import hashlib
import json
import os
import shutil
import time

import webview
from cryptography.fernet import Fernet, InvalidToken

import drive_sync as ds

import sys
FROZEN = getattr(sys, "frozen", False)
HERE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
UI_DIR = os.path.join(HERE, "ui")
DATA_FILE = os.path.join(ds.APP_DIR, "data.json")
TRASH_DIR = os.path.join(ds.APP_DIR, "trash")
LOCK_HEADER = "NFLOCK1"

DEFAULT_DATA = {
    "theme": "dark",
    "snippets": {"brb": "Best Regards,", "todo": "[ ]", "link": "[](url)"},
    "todos": [{"text": "Finish design", "done": True}],
    "events": [{"date": time.strftime("%Y-%m-%d"), "title": "Project Meeting", "time": "10:00"}],
}


def derive_key(password, salt):
    raw = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000, dklen=32)
    return base64.urlsafe_b64encode(raw)


class Api:
    def __init__(self):
        os.makedirs(TRASH_DIR, exist_ok=True)
        self.window = None
        self.sync = ds.DriveSync()
        self.status = "Not synced yet"
        self.unlocked = {}  # note name -> Fernet key, only while the note is open
        self.data = self._load()

    # ----- data file -----
    def _load(self):
        data = dict(DEFAULT_DATA)
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data.update(json.load(f))
        except (OSError, ValueError):
            pass
        return data

    def _save_data(self):
        os.makedirs(ds.APP_DIR, exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    # ----- locked-note format -----
    # file = "NFLOCK1" / salt / check token / encrypted text, one per line
    def _parse_locked(self, text):
        parts = text.split("\n", 3)
        if len(parts) == 4 and parts[0] == LOCK_HEADER:
            return {"salt": base64.b64decode(parts[1]), "check": parts[2], "token": parts[3]}
        return None

    def _path(self, name):
        return os.path.join(ds.NOTES_DIR, os.path.basename(name))

    def _read(self, name):
        with open(self._path(name), "r", encoding="utf-8") as f:
            return f.read()

    def _write_locked(self, name, key, salt, check, plain):
        token = Fernet(key).encrypt(plain.encode("utf-8")).decode()
        content = "\n".join([LOCK_HEADER, base64.b64encode(salt).decode(), check, token])
        with open(self._path(name), "w", encoding="utf-8") as f:
            f.write(content)

    # ----- notes -----
    def list_notes(self):
        out = []
        for n in os.listdir(ds.NOTES_DIR):
            if not n.lower().endswith(ds.NOTE_EXT):
                continue
            path = self._path(n)
            locked = self._parse_locked(self._read(n)) is not None
            out.append({"name": n, "modified": os.path.getmtime(path), "locked": locked})
        out.sort(key=lambda x: x["modified"], reverse=True)
        return out

    def read_note(self, name):
        name = os.path.basename(name)
        text = self._read(name)
        parsed = self._parse_locked(text)
        if parsed is None:
            return {"locked": False, "text": text}
        if name not in self.unlocked:
            return {"locked": True, "text": ""}
        plain = Fernet(self.unlocked[name]).decrypt(parsed["token"].encode()).decode("utf-8")
        return {"locked": False, "text": plain}

    def save_note(self, name, text):
        name = os.path.basename(name)
        parsed = self._parse_locked(self._read(name))
        if parsed is None:
            ds.save_note(name, text)
        elif name in self.unlocked:
            key = self.unlocked[name]
            self._write_locked(name, key, parsed["salt"], parsed["check"], text)
        else:
            return "locked"
        return time.strftime("%H:%M")

    def new_note(self):
        i = 1
        while os.path.exists(os.path.join(ds.NOTES_DIR, f"Untitled {i}.md")):
            i += 1
        name = f"Untitled {i}.md"
        ds.save_note(name, f"# Untitled {i}\n\n")
        return name

    # ----- passwords -----
    def lock_note(self, name, password):
        name = os.path.basename(name)
        if not password or self._parse_locked(self._read(name)) is not None:
            return False
        plain = self._read(name)
        salt = os.urandom(16)
        key = derive_key(password, salt)
        check = Fernet(key).encrypt(b"ok").decode()
        self._write_locked(name, key, salt, check, plain)
        self.unlocked[name] = key
        return True

    def unlock_note(self, name, password):
        name = os.path.basename(name)
        parsed = self._parse_locked(self._read(name))
        if parsed is None:
            return True
        key = derive_key(password or "", parsed["salt"])
        try:
            Fernet(key).decrypt(parsed["check"].encode())
        except InvalidToken:
            return False
        self.unlocked[name] = key
        return True

    def relock_note(self, name):
        self.unlocked.pop(os.path.basename(name), None)
        return True

    def remove_lock(self, name):
        name = os.path.basename(name)
        if name not in self.unlocked:
            return False
        parsed = self._parse_locked(self._read(name))
        plain = Fernet(self.unlocked[name]).decrypt(parsed["token"].encode()).decode("utf-8")
        ds.save_note(name, plain)
        self.unlocked.pop(name, None)
        return True

    # ----- trash -----
    def delete_note(self, name):
        name = os.path.basename(name)
        src = self._path(name)
        if os.path.exists(src):
            shutil.move(src, os.path.join(TRASH_DIR, f"{int(time.time() * 1000)}_{name}"))
        self.unlocked.pop(name, None)
        return True

    def list_trash(self):
        out = []
        for n in os.listdir(TRASH_DIR):
            original = n.split("_", 1)[1] if "_" in n else n
            out.append({"name": n, "title": original, "modified": os.path.getmtime(os.path.join(TRASH_DIR, n))})
        out.sort(key=lambda x: x["modified"], reverse=True)
        return out

    def read_trash(self, name):
        with open(os.path.join(TRASH_DIR, os.path.basename(name)), "r", encoding="utf-8") as f:
            return f.read()

    def restore_note(self, name):
        src = os.path.join(TRASH_DIR, os.path.basename(name))
        original = name.split("_", 1)[1] if "_" in name else name
        target = os.path.join(ds.NOTES_DIR, original)
        base, ext = os.path.splitext(target)
        i = 1
        while os.path.exists(target):
            target = f"{base} ({i}){ext}"
            i += 1
        shutil.move(src, target)
        return True

    def delete_forever(self, name):
        path = os.path.join(TRASH_DIR, os.path.basename(name))
        if os.path.exists(path):
            os.remove(path)
        return True

    def empty_trash(self):
        for n in os.listdir(TRASH_DIR):
            os.remove(os.path.join(TRASH_DIR, n))
        return True

    # ----- sync and login -----
    def sync_now(self):
        try:
            self.status = self.sync.sync_once()
        except Exception as e:
            self.status = f"Sync error: {e}"
        return self.status

    def _on_sync(self, result):
        self.status = result

    def start_background(self):
        self.sync.start_auto(60, on_done=self._on_sync)

    def reset_login(self):
        self.sync.reset_login()
        self.status = "Signed out of Google Drive"
        return True

    # ----- app data -----
    def get_state(self):
        return {"notes": self.list_notes(), "trash_count": len(os.listdir(TRASH_DIR)),
                "data": self.data, "status": self.status}

    def set_theme(self, name):
        self.data["theme"] = name
        self._save_data()
        return True

    def save_data(self, key, value):
        self.data[key] = value
        self._save_data()
        return True


def main():
    api = Api()
    api.window = webview.create_window(
        "NoteForge", url=os.path.join(UI_DIR, "index.html"), js_api=api,
        width=1400, height=880, min_size=(1100, 700), background_color="#0E1019",
    )
    api.start_background()
    webview.start(debug=False)


if __name__ == "__main__":
    main()
