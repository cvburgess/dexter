-- Drives Simulator's Device > Orientation menu (no simctl verb exists); needs
-- Accessibility permission, and raises the named device's window first.

on run argv
  if (count of argv) < 2 then
    error "usage: set-orientation.applescript <device name> <orientation>"
  end if
  set deviceName to item 1 of argv
  set wanted to item 2 of argv

  tell application "Simulator" to activate
  delay 0.5

  tell application "System Events"
    if not (exists process "Simulator") then error "Simulator is not running"
    tell process "Simulator"
      set found to false
      repeat with w in windows
        if name of w starts with deviceName then
          perform action "AXRaise" of w
          set found to true
          exit repeat
        end if
      end repeat
      if not found then error "no Simulator window for " & deviceName
      delay 0.5
      click menu item wanted of menu 1 of menu item "Orientation" ¬
        of menu "Device" of menu bar 1
    end tell
  end tell

  -- Let the rotation animation settle before anything screenshots it.
  delay 1.5
end run
