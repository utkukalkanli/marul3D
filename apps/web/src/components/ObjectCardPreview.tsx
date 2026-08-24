import { Bounds } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function RotatingPart({ previewUrl }: { previewUrl: string }) {
  const geometry = useLoader(STLLoader, previewUrl);
  const group = useRef<Group>(null);
  const reducedMotion = useReducedMotion();
  geometry.computeVertexNormals();

  useFrame((_, delta) => {
    if (!reducedMotion && document.visibilityState !== "hidden" && group.current) {
      group.current.rotation.y += delta * 0.38;
    }
  });

  return (
    <Bounds fit clip observe margin={1.25}>
      <group ref={group} rotation={[0, -0.55, 0]}>
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#b8df75" roughness={0.48} metalness={0.1} />
        </mesh>
      </group>
    </Bounds>
  );
}

function PreviewPlaceholder() {
  return (
    <mesh rotation={[0.35, 0.65, 0.15]}>
      <boxGeometry args={[1.2, 0.55, 0.85]} />
      <meshStandardMaterial color="#536048" wireframe />
    </mesh>
  );
}

export function ObjectCardPreview({ previewUrl, name }: { previewUrl: string; name: string }) {
  return (
    <div className="object-card-preview" role="img" aria-label={`Rotating 3D preview of ${name}`}>
      <Canvas
        camera={{ position: [2.8, 2.1, 3.1], fov: 36 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={1.45} />
        <directionalLight intensity={2.8} position={[4, 6, 5]} />
        <directionalLight intensity={0.7} position={[-4, 1, -3]} color="#b8d2ff" />
        <Suspense fallback={<PreviewPlaceholder />}>
          <RotatingPart previewUrl={previewUrl} />
        </Suspense>
      </Canvas>
      <span className="preview-badge">LIVE 3D</span>
    </div>
  );
}
