# SmilesDrawer Fork

This project uses a modified fork of [SmilesDrawer](https://github.com/reymond-group/smilesDrawer) to render molecular structures from SMILES strings.

## Fork Location

The forked repository is at: `e:\repos\smiles-drawer-fork\`

## Modifications

### Custom Abbreviations in Square Brackets

The fork modifies the PEG grammar (`peg/smiles.pegjs`) to accept arbitrary abbreviations inside square brackets, not just standard element symbols.

**Examples that now work:**
- `CC[TBDPS]` - TBDPS protecting group
- `[Ph]C=O` - Phenyl abbreviation
- `C[OEt]` - Ethoxy group
- `[TMS]C#C[TMS]` - TMS groups
- `C[Ns]` - Nosyl group

**Grammar change:**
```pegjs
bracketcontent = b:(isotope? ('se' / 'as' / aromaticsymbol / customlabel / elementsymbol / wildcard) chiral? hcount? charge? class?) {
    return b;
}

customlabel = c:([A-Z][A-Za-z0-9]*) {
    if(Array.isArray(c)) {
        return c[0] + (c[1] ? c[1].join('') : '');
    }
    return c;
}
```

## Building the Fork

```bash
cd e:\repos\smiles-drawer-fork

# Regenerate parser from grammar
npx pegjs --format globals --export-var Parser peg/smiles.pegjs
# Then manually wrap output in ES module format in src/Parser.js

# Build
npm run build
npm run minify

# Copy to this project
cp dist/smiles-drawer.min.js ../chemistry-by-kei/public/
```

## Test Page

A test page is available at `/smiles-test.html` for manually testing SMILES rendering with custom abbreviations.

## Future: Embeddable Image API

**Status: Planned (not yet implemented)**

For use cases where you need embeddable image URLs (e.g., in markdown, external docs), we plan to create a small Node.js server that renders SMILES to SVG/PNG on the fly.

### Concept

```
GET /api/smiles.svg?s=CC[TBDPS]&w=400&h=300
→ Returns SVG image

GET /api/smiles.png?s=CC[TBDPS]&w=400&h=300
→ Returns PNG image
```

### Implementation Approach

1. Express.js server
2. SmilesDrawer running server-side (pure JS, works in Node)
3. SVG generation using SmilesDrawer's SvgDrawer
4. PNG conversion using `sharp` or `canvas` package
5. Caching layer for performance

### Use Cases

- Embed molecules in markdown: `![Molecule](https://api.example.com/smiles.svg?s=CCO)`
- Documentation
- Chat/messaging integrations
- Static site generators

This will be implemented when the need arises.
