import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Torus } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const AnimatedSphere = ({ position, color, speed, distort, size }: { position: [number, number, number]; color: string; speed: number; distort: number; size: number }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.2;
    }
  });

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={1.2}>
      <Sphere ref={meshRef} args={[size, 64, 64]} position={position}>
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={distort}
          speed={2}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.7}
        />
      </Sphere>
    </Float>
  );
};

const AnimatedTorus = ({ position, color, speed }: { position: [number, number, number]; color: string; speed: number }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * speed * 0.5;
      meshRef.current.rotation.z = state.clock.elapsedTime * speed * 0.3;
    }
  });

  return (
    <Float speed={speed * 0.8} rotationIntensity={0.6} floatIntensity={0.8}>
      <Torus ref={meshRef} args={[0.8, 0.25, 32, 64]} position={position}>
        <meshStandardMaterial
          color={color}
          roughness={0.15}
          metalness={0.9}
          transparent
          opacity={0.5}
        />
      </Torus>
    </Float>
  );
};

const Particles = () => {
  const count = 80;
  const mesh = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.02;
      mesh.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#f97316" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

export const FloatingScene = () => {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#f97316" />
        <pointLight position={[-5, -5, 5]} intensity={0.5} color="#fb923c" />

        <AnimatedSphere position={[-3.5, 1.5, -2]} color="#f97316" speed={1.2} distort={0.4} size={1.2} />
        <AnimatedSphere position={[3, -1, -3]} color="#fb923c" speed={0.8} distort={0.3} size={0.9} />
        <AnimatedSphere position={[0, 2.5, -4]} color="#fdba74" speed={1} distort={0.5} size={0.6} />
        <AnimatedTorus position={[4, 2, -2]} color="#ea580c" speed={0.6} />
        <AnimatedTorus position={[-3, -2, -3]} color="#f97316" speed={0.9} />
        <Particles />
      </Canvas>
    </div>
  );
};
