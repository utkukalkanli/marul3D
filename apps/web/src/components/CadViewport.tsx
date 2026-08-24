import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { RefObject, Suspense, useLayoutEffect, useRef } from "react";
import { Box3, BufferGeometry, Matrix4, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const MODEL_ROTATION_X = -Math.PI / 2;

function StaticCameraFit({ geometry, controlsRef }: {
  geometry: BufferGeometry;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const box = new Box3().copy(geometry.boundingBox);
    box.applyMatrix4(new Matrix4().makeRotationX(MODEL_ROTATION_X));
    const center = box.getCenter(new Vector3());
    const dimensions = box.getSize(new Vector3());
    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z, 1);
    const perspective = camera as typeof camera & { fov?: number };
    const fov = ((perspective.fov ?? 38) * Math.PI) / 180;
    const verticalDistance = maxDimension / (2 * Math.tan(fov / 2));
    const distance = 1.35 * Math.max(verticalDistance, verticalDistance / (size.width / size.height));
    const direction = new Vector3(68, 54, 72).normalize();

    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(distance / 100, 0.01);
    camera.far = Math.max(distance * 100, 2500);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.maxDistance = Math.max(distance * 10, 700);
      controlsRef.current.update();
    }
  }, [camera, controlsRef, geometry, size.height, size.width]);

  return null;
}

function PartMesh({ previewUrl, controlsRef }: {
  previewUrl: string;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const geometry = useLoader(STLLoader, previewUrl);
  geometry.computeVertexNormals();
  return (
    <>
      <StaticCameraFit geometry={geometry} controlsRef={controlsRef} />
      <mesh geometry={geometry} rotation={[MODEL_ROTATION_X, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b8df75" roughness={0.5} metalness={0.08} />
      </mesh>
    </>
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
  const controlsRef = useRef<OrbitControlsImpl>(null);
  return (
    <div className="viewport-canvas" data-testid="cad-viewport">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#151815"]} />
        <PerspectiveCamera makeDefault position={[68, 54, 72]} fov={38} near={0.1} far={2500} />
        <ambientLight intensity={1.1} />
        <directionalLight
          castShadow
          intensity={2.4}
          position={[45, 70, 38]}
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight intensity={0.8} position={[-35, 15, -30]} color="#b7d0ff" />
        <Suspense fallback={<LoadingPart />}>
          <PartMesh previewUrl={previewUrl} controlsRef={controlsRef} />
        </Suspense>
        <Grid
          infiniteGrid
          fadeDistance={520}
          fadeStrength={3}
          cellSize={5}
          sectionSize={25}
          cellColor="#2f352d"
          sectionColor="#44513c"
          position={[0, -0.08, 0]}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={700}
        />
      </Canvas>
      <div className="view-cube" aria-hidden="true">
        <span>TOP</span>
      </div>
      <div className="viewport-hint">Orbit · left drag&nbsp;&nbsp; Pan · right drag&nbsp;&nbsp; Zoom · scroll</div>
    </div>
  );
}
