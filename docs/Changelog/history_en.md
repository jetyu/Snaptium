### v2.0.2 — 2026-06-30 
This update primarily optimizes the knowledge base, application distribution channels, and overall user experience.
#### New
* Added support for the Microsoft Store channel
#### Improvements
* Improved the knowledge base question-and-answer experience issues
* Improved several user experience issues
#### Fixes
* Fixed other known issues

### v2.0.1 — 2026-06-11
This release focuses on improving application stability, cloud sync performance, the update process, and the overall user experience.
#### Improvements
* Refined the Workbench module layout.
* Improved knowledge base performance.
* Improved the note list in workspaces.
* Improved the favorites list.
* Enhanced the appearance of application icons.
* Refined interactions throughout the Preferences interface.
* Improved the application update and download process.
* Increased cloud sync transfer speed.
#### Fixes
* Fixed an issue where keyboard shortcuts could occasionally stop working.
* Fixed an issue where cloud sync could fail under certain conditions.
* Fixed an issue where license verification could fail in offline mode.
* Fixed other known issues.

### v2.0.0 — 2026-05-13
We are excited to announce that NoteWizard has been fully upgraded to Snaptium. Rebuilt on an entirely new architecture, Snaptium delivers a more modern product experience and a significantly expanded set of capabilities.
#### New
* Added the Workbench module for centralized note management, related note recommendations, and recent activity.
* Added an access control module with authentication on application startup.
* Added end-to-end encrypted cloud sync for cross-device data synchronization, with support for WebDAV and S3-compatible object storage services.
* Added the knowledge base, supporting local knowledge retrieval, semantic search, and context-enhanced question answering.
* Added AI service configuration management with support for multiple model configurations.
* Added support for additional Markdown syntax and rendering features.
* Added version history management.
* Added keyboard shortcut management.
* Added customizable editor settings.
#### Improvements
* Improved workspace organization for clearer knowledge structure management.
* Rebuilt the editor architecture to improve the Markdown editing experience and rendering performance.
* Rebuilt the AI writing features with support for content continuation, polishing, rewriting, summarization, and assisted creation.
* Improved overall performance, including startup speed, responsiveness, and system stability.
* Improved the logging module with multi-level log output and enhanced troubleshooting capabilities.


### [1.2.0] - 2026-03-27
#### New
- Added log recording module, supporting multi-level log output.
#### Improvements
- Upgraded Electron runtime framework to v41.0.2.

### [1.1.5] - 2026-03-11
#### Fixes
- Fixed an issue where the note name edit state was not displayed correctly.
    
### [1.1.4] - 2026-03-08
This update includes several important fixes and performance improvements, further enhancing the stability and security of the software.
#### Fixes
- Fixed an issue that caused key verification to fail when the configuration file was missing.
- Fixed an issue where the note status icon was not displayed in read-only mode.
- Fixed potential data inconsistency issue.
#### Improvements
- Improved the preview interface rendering mechanism to improve scrolling smoothness.
- Improved context menu of editor. 

### [1.1.3] - 2026-03-04
#### Fixes
- Fixed an issue where custom note save paths could cause encryption failures in specific cases.
- Fixed missing translations in certain languages.
#### Improvements
- Refactored the note read/write mechanism by adopting asynchronous writes and improving the atomic write workflow, ensuring data consistency.
- Renamed locking/unlocking feature: “Lock Note” is now “Read-Only Mode”, and “Unlock Note” is now “Edit Mode”.
- Improved note properties panel, now supporting copy of note information.
- Optimized preference export workflow.
- Enhanced encryption and decryption experience.
- Improved feedback workflow for submitting and viewing issues.

### [1.1.2] - 2026-02-27
#### Fixes
- Fixed a rendering issue introduced by the note lock feature

### [1.1.1] - 2026-02-26
#### Fixes
- Fixed an issue where note properties could not be obtained after changing the note save path.
#### Improvements
- Upgraded the Electron runtime framework to v40.6.1.

### [1.1.0] - 2026-02-24
#### New
- Support note locking: Lock to instantly make it read-only preview mode; unlock to jump straight into editing.

### [1.0.8] - 2026-02-21
#### Fixes
- Fixed an issue where notes could be lost in special scenarios.

### [1.0.7] - 2026-01-27
#### Fixes
- Fixed an issue where the copy code button tooltip text was not updated correctly when switching languages in preview mode.
#### Updated
- Updated the links for Privacy Policy, User Agreement, and User Manual.

### [1.0.6] - 2026-01-24
This release includes several critical fixes and performance improvements, further enhancing the stability and security.
#### Fixes
- Fixed an issue with list sorting when moving notes, ensuring note order is accurate.  
- Fixed an XSS vulnerability introduced in version v1.0.4 in the search functionality, improving overall security.  
- Updated and patched dependencies to address security vulnerabilities.
#### Improvements
- Optimized scrolling and rendering performance in note preview mode, enhancing real-time rendering speed and responsiveness.  
- Improved the user experience when moving notes.
- Upgraded Electron runtime framework to v39.3.0.

### [1.0.5] - 2026-01-22
#### Fixes
- Fixed an issue where the cursor was not correctly positioned after inserting a code block.
- Fixed an issue where selected text was not properly wrapped when inserting a code block.
- Fixed layout issues caused by resizing the application window.
- Fixed potential security issues in the decompression process.
#### Improvements
- Improved the maximum draggable width in preview mode to enhance the fullscreen experience.

### [1.0.4] - 2026-01-20
#### Fixes
- Fixed an issue where the search function was not working.
#### Improvements
- Improved the performance of search function

### [1.0.3] - 2026-01-17
#### Improvements
- Improved the experience of copying code blocks in preview mode.

### [1.0.2] - 2026-01-16
#### Fixes
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
#### Fixes
- Fixed an issue where exporting encrypted Markdown (.md) files could fail when encryption was enabled.
- Fixed an issue where the editor cursor would disappear after using the "Properties" or "Delete" options in the context menu.
- Fixed button focus issue.
#### Improvements
- Upgraded the Electron runtime framework to v39.2.6.
- Upgraded the CodeMirror editor framework to v5.65.20.
- Improved the software update workflow and user interactions.

### [0.4.4] - 2025-12-08
#### Improvements
- Improved the user experience of the preferences panel.

### [0.4.3] - 2025-12-07
#### Fixes
- Fixed an issue that could cause encrypted note content to be lost in certain scenarios.
- Fixed an issue where encrypted notes could not be decrypted after importing preference settings and restarting the app.
#### Improvements
- Improved preview experience.
- Improved the interaction experience of the notes list.
- Improved the options in the notes context menu.

### [0.4.2] - 2025-11-30
#### New
- Added an emergency decryption feature for local notes to restore encrypted content in special scenarios.
#### Fixes
- Fixed an issue where content in the Recycle Bin could not be encrypted properly.
#### Improvements
- Enhanced the interaction experience of the preferences pane.

### [0.4.1] - 2025-11-28
#### Fixes
- Fixed an issue where the search bar could not perform searches.
- Fixed an issue where encryption could not be disabled in certain scenarios.
#### Improvements
- Improved the interaction experience of security-related features.
- Improved the interaction experience when exporting the .nwp format.

### [0.4.0] - 2025-11-24
#### New
- Added local note encryption using the AES-256-GCM algorithm for on-device data protection.
#### Fixes
- Fixed an issue where the Windows version could leave a background process running after uninstallation in certain scenarios.
- Fixed translation issues in several non-English languages.
#### Improvements
- Optimized view rendering performance.
- Improved default language initialization.
- Optimized application startup speed.
- Improved the interaction experience of exporting the .nwp format.

### [0.3.2] - 2025-10-26
#### Improvements
- Optimized the performance of the editor.

### [0.3.1] - 2025-10-25
#### Fixes
- Fixed missing translation issues in other languages.
#### Improvements
- Improved the interactive experience of the Check for Updates panel.

### [0.3.0] - 2025-10-24
#### New
- Added note import and export functionality, supporting the import and export of Snaptium Portable Package Exchange (.nwp) and Markdown (.md) formats.
#### Fixes
- Fixed known issues.
- Fixed translation issues in other languages.
#### Improvements
- Refactored the Preferences panel code.
- Improved the Recycle Bin experience.
- Optimized the update log module loading performance.
- Optimized VFS performance.
- Optimized the IPC module.

### [0.2.6] - 2025-10-04
#### Improvements
- Improved the editor experience.

### [0.2.5] - 2025-10-03
#### Fixes
- Fixed an issue introduced in version 0.2.2 that caused the note list in the workspace not to refresh in real time after restarting.

### [0.2.4] - 2025-10-03
#### New
- Added software update feature.
#### Fixes
- Fixed an issue where the workspace was incorrectly collapsed when closing the preview panel.

### [0.2.2] - 2025-10-02
#### Fixes
- Fixed hardcoded internationalization issues.
- Fixed an issue where the menu bar language did not update after switching languages and restarting.
#### Improvements
- Optimized logic for importing, exporting, and resetting preferences configuration.

### [0.2.1] - 2025-10-01
#### New
- Added automatic build support for Windows, macOS, and Linux installers.
- Added view switching functionality.
- Added AI service settings for input delay, minimum input length, system prompt, and network connectivity test for AI service endpoints.
#### Fixes
- Fixed context menu issues.
- Fixed several known translation issues.
- Fixed several known UI issues.
- Fixed cursor position issue in AI suggestions.
- Fixed an outline display error introduced in version 0.1.0.
#### Improvements
- Improved interaction experience in the Preferences interface.
- Refactored AI service interfaces to support all AI services compatible with the OpenAI API.

### [0.1.0] - 2025-09-20
#### Fixes
- Fixed scrollbar issue in the note list.
- Fixed deletion logic issue in the Recycle Bin.
- Fixed registry residue issue after disabling startup on boot.
#### Improvements
- Improved Recycle Bin interface and interaction.

### [0.0.9-dev] - 2025-09-15
#### Improvements
- Improved high-resolution display adaptation.

### [0.0.8-dev] - 2025-09-13
#### Fixes
- Fixed inaccurate translations in some languages.
- Fixed untranslated text on some pages.
- Fixed layout misalignment on some pages when switching languages.
- Fixed an issue introduced in version 0.0.7 where language switching caused import/export settings to fail.

### [0.0.7-dev] - 2025-09-11
#### New
- Added support for 18 languages and regions: English, French, Russian, German, Italian, etc.
- Added system tray icon and startup on boot.
#### Fixes
- Fixed incorrect file size display in note properties dialog.
- Fixed rare cases where icons or changelog content failed to load on startup.
- Fixed incorrect file path display in some cases when creating a new note in the workspace.
- Fixed rare cases where canceling a rename operation was not properly recognized.
#### Improvements
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
#### Fixes
- Fixed incorrect version number display on the About page.
- Fixed AI service provider list loading failure in some cases.
- Fixed content security policy issue introduced in version 0.0.4.
#### Improvements
- Improved interaction logic and experience for custom note file save path.

### [0.0.4-dev] - 2025-08-03
#### New
- Added developer tools module.

### [0.0.3-dev] - 2025-07-29
#### New
- Added font size and font family settings.
- Added About panel, Changelog page, and Check for Updates module.
#### Fixes
- Fixed misaligned UI elements in some cases.
- Fixed reset actions not taking effect when switching to English interface.
- Fixed note save failure in certain cases.
- Fixed window size memory function failure.
- Fixed incorrect path when creating notes via context menu in some cases.
- Fixed AI configuration panel language not updating in real time when switching app language.
#### Improvements
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

