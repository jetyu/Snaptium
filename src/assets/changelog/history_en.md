### [1.1.3] - 2026-03-06
#### Fixed
- Fixed incomplete translations in certain languages.
- Fixed an issue where, in some cases, using a custom note save path could cause note encryption to fail.
#### Improved
- Improved the interaction experience of the note lock/unlock feature.
- Improved the user experience of the preferences export workflow.
- Improved the overall usability of the encryption and decryption process.

### [1.1.2] - 2026-02-27
#### Fixed
- Fixed a rendering issue introduced by the note lock feature

### [1.1.1] - 2026-02-26
#### Fixed
- Fixed an issue where note properties could not be obtained after changing the note save path.
#### Improved
- Upgraded the Electron runtime framework to v40.6.1.

### [1.1.0] - 2026-02-24
#### New
- Support note locking: Lock to instantly make it read-only preview mode; unlock to jump straight into editing.

### [1.0.8] - 2026-02-21
#### Fixed
- Fixed an issue where notes could be lost in special scenarios.

### [1.0.7] - 2026-01-27
#### Fixed
- Fixed an issue where the copy code button tooltip text was not updated correctly when switching languages in preview mode.
#### Updated
- Updated the links for Privacy Policy, User Agreement, and User Manual.

### [1.0.6] - 2026-01-24
This release includes several critical fixes and performance improvements, further enhancing the stability and security.
#### Fixed
- Fixed an issue with list sorting when moving notes, ensuring note order is accurate.  
- Fixed an XSS vulnerability introduced in version v1.0.4 in the search functionality, improving overall security.  
- Updated and patched dependencies to address security vulnerabilities.
#### Improved
- Optimized scrolling and rendering performance in note preview mode, enhancing real-time rendering speed and responsiveness.  
- Improved the user experience when moving notes.
- Upgraded Electron runtime framework to v39.3.0.

### [1.0.5] - 2026-01-22
#### Fixed
- Fixed an issue where the cursor was not correctly positioned after inserting a code block.
- Fixed an issue where selected text was not properly wrapped when inserting a code block.
- Fixed layout issues caused by resizing the application window.
- Fixed potential security issues in the decompression process.
#### Improved
- Improved the maximum draggable width in preview mode to enhance the fullscreen experience.

### [1.0.4] - 2026-01-20
#### Fixed
- Fixed an issue where the search function was not working.
#### Improved
- Improved the performance of search function

### [1.0.3] - 2026-01-17
#### Improved
- Improved the experience of copying code blocks in preview mode.

### [1.0.2] - 2026-01-16
#### Fixed
- Fixed an issue where the status bar had missing translations in other languages.

### [1.0.1] - 2026-01-15
#### New
- Supports code highlighting for mainstream programming languages.
- Supports copying code blocks during preview.

### [1.0.0] - 2026-01-01
We are pleased to announce the official release of NoteWizard v1.0.
During 7 months of continuous iteration and optimization, this version delivers significant improvements in stability and overall user experience.
#### New
- Support for automatic background update checking and downloading to ensure users always stay on the latest version.
- Real-time word count display while editing notes.
#### Fixed
- Fixed an issue where exporting encrypted Markdown (.md) files could fail when encryption was enabled.
- Fixed an issue where the editor cursor would disappear after using the "Properties" or "Delete" options in the context menu.
- Fixed button focus issue.
#### Improved
- Upgraded the Electron runtime framework to v39.2.6.
- Upgraded the CodeMirror editor framework to v5.65.20.
- Improved the software update workflow and user interactions.

### [0.4.4] - 2025-12-08
#### Improved
- Improved the user experience of the preferences panel.

### [0.4.3] - 2025-12-07
#### Fixed
- Fixed an issue that could cause encrypted note content to be lost in certain scenarios.
- Fixed an issue where encrypted notes could not be decrypted after importing preference settings and restarting the app.
#### Improved
- Improved preview experience.
- Improved the interaction experience of the notes list.
- Improved the options in the notes context menu.

### [0.4.2] - 2025-11-30
#### New
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
#### New
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
#### New
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
#### New
- Added software update feature.
#### Fixed
- Fixed an issue where the workspace was incorrectly collapsed when closing the preview panel.

### [0.2.2] - 2025-10-02
#### Fixed
- Fixed hardcoded internationalization issues.
- Fixed an issue where the menu bar language did not update after switching languages and restarting.
#### Improved
- Optimized logic for importing, exporting, and resetting preferences configuration.

### [0.2.1] - 2025-10-01
#### New
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
#### New
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
#### New
- Added user guide module.

### [0.0.5-dev] - 2025-08-29
#### New
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
#### New
- Added developer tools module.

### [0.0.3-dev] - 2025-07-29
#### New
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
#### New
- Added dark mode support.
- Added configuration support for AI providers such as OpenAI ChatGPT, xAI Grok, DeepSeek, Qwen, etc.

### [0.0.1-dev] - 2025-05-22
#### New
- Initial release of the application.
- Implemented core Markdown editor with real-time preview.
- Added support for Windows 7 and later operating systems.
