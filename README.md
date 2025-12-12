# Pathways Practice

A community-driven web application for practicing organic chemistry synthesis pathways.

## Inspiration

This project was inspired by the fantastic [Chemistry By Design](https://chemistrybydesign.oia.arizona.edu/) app created by the team at the University of Arizona. Their platform is an excellent resource for learning organic chemistry synthesis, and I highly recommend checking it out.

However, while using their app, I ran into a couple of frustrations:
- **State loss**: The app returns to the main menu whenever you close it or switch to another app, which is especially problematic when wanting to google something.
- **No offline support**: You can't use the app without an internet connection

These issues motivated me to create my own solution - a Progressive Web App (PWA) that maintains your progress and works fully offline.

## Features

- Browse and study chemical synthesis pathways
- Quiz mode to test your knowledge
- Works offline (PWA with service worker caching)
- Maintains state when backgrounded
- Mobile-first design optimized for phones and tablets
- Desktop support

## Technical Details

### SMILES Rendering

The webapp uses the [SMILES](https://en.wikipedia.org/wiki/Simplified_molecular-input_line-entry_system) (Simplified Molecular Input Line Entry System) format for representing molecular structures. For rendering, we use [SmilesDrawer 2.0](https://github.com/reymond-group/smiern-drawer), which has been adapted to support custom abbreviations.

### Tech Stack

- React 19
- Vite
- React Router
- PWA (vite-plugin-pwa)
- SmilesDrawer 2.0

## Development

This project was developed with the assistance of AI coding tools:
- **Claude Code** (Anthropic) - Primary development
- **Gemini** (Google) - Synthesis data extraction

### Data Sourcing

The synthesis pathways are added by using Gemini to extract information from screenshots of the Chemistry By Design website. This approach allows for efficient data entry while ensuring accuracy.

## Disclaimer

**This is a passion project created purely for the community.**

- This project has **no monetization** whatsoever
- It is not affiliated with Chemistry By Design or the University of Arizona
- All synthesis data is intended for educational purposes only
- If you're looking for the official, comprehensive resource, please visit [Chemistry By Design](https://chemistrybydesign.oia.arizona.edu/)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Live Demo

Visit the live application at: [https://opensynth19904.z20.web.core.windows.net/](https://opensynth19904.z20.web.core.windows.net/)

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

This project is open source and available for educational use.
