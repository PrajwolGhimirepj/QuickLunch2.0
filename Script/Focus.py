import win32gui
import win32con
import win32process
import psutil
import ctypes
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


def is_snapped(hwnd):
    """Returns True if window is snapped/split-screened."""
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)

    screen_w = ctypes.windll.user32.GetSystemMetrics(0)
    screen_h = ctypes.windll.user32.GetSystemMetrics(1)

    width = right - left
    height = bottom - top

    # Maximized window is roughly screen size.
    # Snapped window usually uses about half the screen width.
    return width < screen_w * 0.9 and height > screen_h * 0.8


hwnd = get_chrome_hwnd()

if hwnd:

    # Check if Chrome is already focused
    foreground = win32gui.GetForegroundWindow()

    if foreground == hwnd:
        print("Chrome is already on top. No action taken.")

    elif is_snapped(hwnd):
        print("Chrome is in split-screen mode. No action taken.")

    else:
        placement = win32gui.GetWindowPlacement(hwnd)

        # Restore if minimized
        if placement[1] == win32con.SW_SHOWMINIMIZED:
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            time.sleep(0.05)

        # Maximize
        win32gui.ShowWindow(hwnd, win32con.SW_MAXIMIZE)
        time.sleep(0.05)

        # Bring to front
        win32gui.BringWindowToTop(hwnd)
        win32gui.SetForegroundWindow(hwnd)

        print("Chrome brought to front and maximized.")