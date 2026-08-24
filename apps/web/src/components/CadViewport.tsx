import { Bounds, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense } from "react";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

function PartMesh({ previewUrl }: { previewUrl: string }) {
  const geometry = useLoader(STLLoader, previewUrl);
  geometry.computeVertexNormals();
  return (
    <Bounds fit clip observe margin={1.35}>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b8df75" roughness={0.5} metalness={0.08} />
      </mesh>
    </Bounds>
  );
}

function LoadingPart() {
  return (
    <mesh>
      <boxGeometry args={[20, 6, 12]} />
      <meshStandardMaterial color="#58614f" wireframe />
    </mesh>
  );
}

export function CadViewport({ previewUrl }: { previewUrl: string }) {
  return (
    <div className="viewport-canvas" data-testid="cad-viewport">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#151815"]} />
        <fog attach="fog" args={["#151815", 100, 360]} />
        <PerspectiveCamera makeDefault position={[68, 54, 72]} fov={38} />
        <ambientLight intensity={1.1} />
        <directionalLight
          castShadow
          intensity={2.4}
          position={[45, 70, 38]}
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight intensity={0.8} position={[-35, 15, -30]} color="#b7d0ff" />
        <Suspense fallback={<LoadingPart />}>
          <PartMesh previewUrl={previewUrl} />
        </Suspense>
        <Grid
          infiniteGrid
          fadeDistance={180}
          fadeStrength={3}
          cellSize={5}
          sectionSize={25}
          cellColor="#2f352d"
          sectionColor="#44513c"
          position={[0, -0.08, 0]}
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
      <div className="view-cube" aria-hidden="true">
        <span>TOP</span>
      </div>
      <div className="viewport-hint">Orbit · left drag&nbsp;&nbsp; Pan · right drag&nbsp;&nbsp; Zoom · scroll</div>
    </div>
  );
}
