### [0.4.2] - 2025-11-30
#### Added
- Added an emergency decryption feature for local notes to restore encrypted content in special scenarios.
#### Fixed
- Fixed an issue where content in the Recycle Bin could not be encrypted properly.
#### Improved
- Enhanced the interaction experience of the preferences pane.

### [0.4.1] - 2025-11-28
#### Fixed
- Fixed an issue where the search bar could not perform searches.
- Fixed an issue where encryption could not be disabled in certain scenarios.
#### Improved
- Improved the interaction experience of security-related features.
- Improved the interaction experience when exporting the .nwp format.

### [0.4.0] - 2025-11-24
#### Added
- Added local note encryption using the AES-256-GCM algorithm for on-device data protection.
#### Fixed
- Fixed an issue where the Windows version could leave a background process running after uninstallation in certain scenarios.
- Fixed translation issues in several non-English languages.
#### Improved
- Optimized view rendering performance.
- Improved default language initialization.
- Optimized application startup speed.
- Improved the interaction experience of exporting the .nwp format.

### [0.3.2] - 2025-10-26
#### Improved
- Optimized the performance of the editor.

### [0.3.1] - 2025-10-25
#### Fixed
- Fixed missing translation issues in other languages.
#### Improved
- Improved the interactive experience of the Check for Updates panel.

### [0.3.0] - 2025-10-24
#### Added
- Added note import and export functionality, supporting the import and export of NoteWizard Package (.nwp) and Markdown (.md) formats.
#### Fixed
- Fixed known issues.
- Fixed translation issues in other languages.
#### Improved
- Refactored the Preferences panel code.
- Improved the Recycle Bin experience.
- Optimized the update log module loading performance.
- Optimized VFS performance.
- Optimized the IPC module.

### [0.2.6] - 2025-10-04
#### Improved
- Improved the editor experience.

### [0.2.5] - 2025-10-03
#### Fixed
- Fixed an issue introduced in version 0.2.2 that caused the note list in the workspace not to refresh in real time after restarting.

### [0.2.4] - 2025-10-03
#### Added
- Added automatic software update feature.
#### Fixed
- Fixed an issue where the workspace was incorrectly collapsed when closing the preview panel.

### [0.2.2] - 2025-10-02
#### Fixed
- Fixed hardcoded internationalization issues.
- Fixed an issue where the menu bar language did not update after switching languages and restarting.
#### Improved
- Optimized logic for importing, exporting, and resetting preferences configuration.

### [0.2.1] - 2025-10-01
#### Added
- Added automatic build support for Windows, macOS, and Linux installers.
- Added view switching functionality.
- Added AI service settings for input delay, minimum input length, system prompt, and network connectivity test for AI service endpoints.
#### Fixed
- Fixed context menu issues.
- Fixed several known translation issues.
- Fixed several known UI issues.
- Fixed cursor position issue in AI suggestions.
- Fixed an outline display error introduced in version 0.1.0.
#### Improved
- Improved interaction experience in the Preferences interface.
- Refactored AI service interfaces to support all AI services compatible with the OpenAI API.

### [0.1.0] - 2025-09-20
#### Fixed
- Fixed scrollbar issue in the note list.
- Fixed deletion logic issue in the Recycle Bin.
- Fixed registry residue issue after disabling startup on boot.
#### Improved
- Improved Recycle Bin interface and interaction.

### [0.0.9-dev] - 2025-09-15
#### Improved
- Improved high-resolution display adaptation.

### [0.0.8-dev] - 2025-09-13
#### Fixed
- Fixed inaccurate translations in some languages.
- Fixed untranslated text on some pages.
- Fixed layout misalignment on some pages when switching languages.
- Fixed an issue introduced in version 0.0.7 where language switching caused import/export settings to fail.

### [0.0.7-dev] - 2025-09-11
#### Added
- Added support for 18 languages and regions: English, French, Russian, German, Italian, etc.
- Added system tray icon and startup on boot.
#### Fixed
- Fixed incorrect file size display in note properties dialog.
- Fixed rare cases where icons or changelog content failed to load on startup.
- Fixed incorrect file path display in some cases when creating a new note in the workspace.
- Fixed rare cases where canceling a rename operation was not properly recognized.
#### Improved
- Upgraded Electron framework to version 37.4.0.
- Optimized installer package size.
- Improved notebook expand/collapse state.
- Optimized resource loading logic.
- Refactored multilingual switching logic.
#### Removed
- Dropped support for Windows 32-bit (x86). Now only supports **Windows 10 and later 64-bit operating systems**.

### [0.0.6-dev] - 2025-08-30
#### Added
- Added user guide module.

### [0.0.5-dev] - 2025-08-29
#### Added
- Added context menu option to open file location.
- Added import/export for user preferences configuration.
- Added custom save path option for note files.
- Added preferences shortcut key.
- Added support for the latest AI models.
#### Fixed
- Fixed incorrect version number display on the About page.
- Fixed AI service provider list loading failure in some cases.
- Fixed content security policy issue introduced in version 0.0.4.
#### Improved
- Improved interaction logic and experience for custom note file save path.

### [0.0.4-dev] - 2025-08-03
#### Added
- Added developer tools module.

### [0.0.3-dev] - 2025-07-29
#### Added
- Added font size and font family settings.
- Added About panel, Changelog page, and Check for Updates module.
#### Fixed
- Fixed misaligned UI elements in some cases.
- Fixed reset actions not taking effect when switching to English interface.
- Fixed note save failure in certain cases.
- Fixed window size memory function failure.
- Fixed incorrect path when creating notes via context menu in some cases.
- Fixed AI configuration panel language not updating in real time when switching app language.
#### Improved
- Improved default window size to support more display devices.
- Improved page transition and animation effects.
- Improved interaction experience across multiple UI elements.
- Improved application startup speed.

### [0.0.2-dev] - 2025-05-27
#### Added
- Added dark mode support.
- Added configuration support for AI providers such as OpenAI ChatGPT, xAI Grok, DeepSeek, Qwen, etc.

### [0.0.1-dev] - 2025-05-22
#### Added
- Initial release of the application.
- Implemented core Markdown editor with real-time preview.
- Added support for Windows 7 and later operating systems.
