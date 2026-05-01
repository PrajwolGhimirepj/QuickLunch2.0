import win32gui
import win32con
import win32process
import psutil
import time

def get_chrome_hwnd():
    hwnds = []

    def enum_handler(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                if "chrome" in psutil.Process(pid).name().lower():
                    hwnds.append(hwnd)
            except:
                pass

    win32gui.EnumWindows(enum_handler, None)
    return hwnds[0] if hwnds else None


hwnd = get_chrome_hwnd()

if hwnd:
    # 1. Restore window
    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    time.sleep(0.05)

    # 2. Maximize (full window fullscreen)
    win32gui.ShowWindow(hwnd, win32con.SW_MAXIMIZE)
    time.sleep(0.05)

    # 3. Force to top layer
    win32gui.BringWindowToTop(hwnd)

    # 4. HARD focus attempt
    win32gui.SetForegroundWindow(hwnd)