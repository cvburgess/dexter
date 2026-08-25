-- Set a booted simulator's orientation.
--
--   osascript set-orientation.applescript "iPad Pro 13-inch (M5)" "Landscape Left"
--
-- There is no `simctl` verb for this — orientation lives only in the Simulator
-- app's Device > Orientation menu — so this drives that menu, which needs
-- Accessibility permission for whatever runs it (Terminal, iTerm, or the
-- editor). Grant it in System Settings > Privacy & Security > Accessibility.
--
-- The menu applies to the *focused* device window and several simulators are
-- usually booted at once, so this raises the named device's window first.
--
-- Note that rotating does not change what `simctl io screenshot` hands back: it
-- always captures the native portrait framebuffer, with the content turned 90°.
-- `scripts/flatten-screenshot.swift --rotate-ccw` straightens it.

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
