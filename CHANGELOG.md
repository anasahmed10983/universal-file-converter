# Changelog

## Version 2.0.0 - December 2025

### 🎉 Major Release - Complete Redesign

#### ✨ New Features
- **Multi-language Support**: Full i18n system with 4 languages (EN, TR, DE, ZH)
- **Batch Processing**: Apply format to all files at once
- **Progress Tracking**: Visual progress bar for batch conversions
- **Theme Persistence**: Light/Dark mode saves your preference
- **Language Persistence**: Your language choice is remembered
- **Improved Error Handling**: Retry functionality for failed conversions
- **Native Dropdowns**: Proper dark mode support for all selects

#### 🎨 UI/UX Improvements
- Complete glassmorphism redesign
- Enhanced light mode contrast for better visibility
- Larger, more accessible buttons (px-5 py-2.5)
- Better spacing between elements
- File type icons for visual recognition
- Smooth animations and transitions
- Mobile-responsive design improvements

#### 🐛 Bug Fixes
- Fixed duplicate language button initialization
- Removed obsolete custom select listener
- Corrected data-i18n handling for nested objects
- Fixed theme toggle body class override
- Resolved select dropdown white background in dark mode
- Fixed missing PDF group translation
- Corrected removeFile parameter in error cards
- Fixed goBack cleanup - now properly clears all data

#### 🔧 Technical Improvements
- Pure DOM manipulation - no global registries
- Native HTML select elements
- %100 i18n coverage (93 translation keys)
- Removed unused code and dependencies
- Better code organization and comments
- Enhanced cross-browser compatibility

#### 📚 Documentation
- Multi-language README (EN/TR/DE/ZH)
- Comprehensive feature documentation
- Improved installation guide
- Project structure documentation

---

## Version 1.1.0 - Legacy

### Features
- Basic file conversion
- Support for image, video, audio, documents
- Simple UI with dark mode
- Drag & drop functionality

---

## Version 1.0.0 - Initial Release

### Features
- Core conversion functionality
- Basic file format support
- Simple web interface
