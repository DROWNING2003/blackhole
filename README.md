# Blackhole

Real-time Schwarzschild black hole visualization with gravitational lensing, accretion disk, and relativistic effects.

![Blackhole Demo](https://github.com/junhoyeo/blackhole/raw/main/public/assets/demo.png)

## Features

- **Gravitational Lensing**: Ray marching along Schwarzschild geodesics
- **Accretion Disk**: Thin disk model with temperature gradient
- **Relativistic Doppler Shift**: Color shift based on relative velocity
- **Relativistic Beaming**: Intensity boost from approaching matter
- **Lorentz Transform**: Light aberration from observer motion
- **Orbital Camera**: Stable circular orbit around the black hole

## Installation

```bash
npm install @junhoyeo/blackhole
```

## Usage

### Vanilla Three.js

```typescript
import { BlackholeRenderer } from '@junhoyeo/blackhole';

const renderer = new BlackholeRenderer({
  canvas: document.getElementById('canvas'),
  quality: 'medium',
  cameraDistance: 10,
  fieldOfView: 90,
  enableOrbit: true,
  showAccretionDisk: true,
  enableLorentzTransform: true,
  enableDopplerShift: true,
  enableBeaming: true,
  bloomStrength: 1.0,
  bloomRadius: 0.5,
  bloomThreshold: 0.6,
});

renderer.start();
```

### React

```tsx
import { BlackholeBackground } from '@junhoyeo/blackhole';

function App() {
  return (
    <BlackholeBackground
      quality="medium"
      cameraDistance={10}
      enableOrbit={true}
    />
  );
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `quality` | `'low' \| 'medium' \| 'high' \| 'ultra'` | `'medium'` | Ray marching quality preset |
| `cameraDistance` | `number` | `10` | Distance from black hole (Schwarzschild radii) |
| `fieldOfView` | `number` | `90` | Camera FOV in degrees |
| `enableOrbit` | `boolean` | `true` | Enable orbital camera motion |
| `showAccretionDisk` | `boolean` | `true` | Show accretion disk |
| `enableLorentzTransform` | `boolean` | `true` | Enable light aberration |
| `enableDopplerShift` | `boolean` | `true` | Enable Doppler color shift |
| `enableBeaming` | `boolean` | `true` | Enable relativistic beaming |
| `bloomStrength` | `number` | `1.0` | Bloom post-process strength |
| `bloomRadius` | `number` | `0.5` | Bloom radius |
| `bloomThreshold` | `number` | `0.6` | Bloom threshold |

## Development

```bash
git clone https://github.com/junhoyeo/blackhole.git
cd blackhole
npm install
npm run dev
```

## Physics Background

### Schwarzschild Metric

The Schwarzschild solution describes spacetime geometry around a non-rotating, uncharged black hole:

```
ds² = -(1 - rs/r)dt² + (1 - rs/r)⁻¹dr² + r²dΩ²
```

where `rs = 2GM/c²` is the Schwarzschild radius.

### Geodesic Ray Marching

Light follows null geodesics in curved spacetime. The effective potential for photon orbits:

```
V_eff(r) = (1 - rs/r) * L²/r²
```

The photon sphere exists at `r = 1.5 * rs` where light can orbit the black hole.

### Relativistic Effects

- **Doppler Factor**: `δ = 1 / (γ(1 - β·n))` where `β = v/c`
- **Beaming**: Intensity scales as `δ⁴` for isotropic emission
- **Aberration**: Light direction transforms under Lorentz boost

## References

### Papers & Textbooks

1. Schwarzschild, K. (1916). "Über das Gravitationsfeld eines Massenpunktes nach der Einsteinschen Theorie"
2. Luminet, J.-P. (1979). "Image of a spherical black hole with thin accretion disk". Astronomy and Astrophysics, 75, 228-235
3. Misner, C. W., Thorne, K. S., & Wheeler, J. A. (1973). "Gravitation". W. H. Freeman
4. James, O., et al. (2015). "Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar". Classical and Quantum Gravity, 32(6)

### Online Resources

- [NASA - Black Hole Visualization](https://svs.gsfc.nasa.gov/13326)
- [Rantonels - Starless](https://github.com/rantonels/starless) - Python black hole raytracer
- [UCLA Galactic Center Group](https://galacticcenter.astro.ucla.edu/)

### Inspiration

This project was inspired by [vlwkaos/threejs-blackhole](https://github.com/vlwkaos/threejs-blackhole). This is a clean-room Apache 2.0 licensed reimplementation based on the same underlying physics (which is public domain knowledge), with independently written code.

## License

Apache License 2.0 - See [LICENSE](./LICENSE) for details.

## Author

[Junho Yeo](https://github.com/junhoyeo)
