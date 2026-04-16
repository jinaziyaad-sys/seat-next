import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import * as THREE from "three";

// A stylized fork shape using extrusion
const Fork = ({ scrollProgress }: { scrollProgress: number }) => {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = scrollProgress * Math.PI * 2;
    group.current.rotation.x = Math.sin(scrollProgress * Math.PI) * 0.5;
    group.current.position.y = Math.sin(scrollProgress * Math.PI * 2) * 0.3;
  });

  return (
    <group ref={group} position={[-2, 0, 0]}>
      {/* Handle */}
      <mesh position={[0, -1.2, 0]}>
        <capsuleGeometry args={[0.08, 2, 8, 16]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Tines */}
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0.8, 0]}>
          <capsuleGeometry args={[0.025, 0.8, 6, 12]} />
          <meshStandardMaterial color="#d4d4d4" metalness={0.95} roughness={0.08} />
        </mesh>
      ))}
      {/* Neck connector */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.06]} />
        <meshStandardMaterial color="#c8c8c8" metalness={0.9} roughness={0.12} />
      </mesh>
    </group>
  );
};

// A stylized knife
const Knife = ({ scrollProgress }: { scrollProgress: number }) => {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = -scrollProgress * Math.PI * 1.5;
    group.current.rotation.z = Math.cos(scrollProgress * Math.PI) * 0.3;
    group.current.position.y = Math.cos(scrollProgress * Math.PI * 2) * 0.3;
  });

  return (
    <group ref={group} position={[2, 0, 0]}>
      {/* Handle */}
      <mesh position={[0, -1.2, 0]}>
        <capsuleGeometry args={[0.08, 2, 8, 16]} />
        <meshStandardMaterial color="#b8b8b8" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Blade */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.18, 1.2, 0.02]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.98} roughness={0.05} />
      </mesh>
    </group>
  );
};

// A plate / dish
const Plate = ({ scrollProgress }: { scrollProgress: number }) => {
  const group = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.x = -Math.PI / 2 + Math.sin(scrollProgress * Math.PI) * 0.2;
    group.current.rotation.z = scrollProgress * Math.PI * 0.5;
    group.current.position.y = -0.5 + Math.sin(scrollProgress * Math.PI) * 0.5;
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <mesh>
        <torusGeometry args={[1, 0.15, 16, 48]} />
        <meshStandardMaterial color="#f5f5f0" metalness={0.1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.04, 48]} />
        <meshStandardMaterial color="#fafaf5" metalness={0.05} roughness={0.4} />
      </mesh>
    </group>
  );
};

// Floating food particles (small spheres with warm colors)
const FoodParticles = ({ scrollProgress }: { scrollProgress: number }) => {
  const group = useRef<THREE.Group>(null!);
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
      ] as [number, number, number],
      color: ["#f97316", "#ef4444", "#22c55e", "#eab308", "#f59e0b", "#10b981"][i % 6],
      size: 0.06 + Math.random() * 0.08,
      speed: 0.5 + Math.random() * 1.5,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = scrollProgress * Math.PI;
    group.current.children.forEach((child, i) => {
      const p = particles[i];
      child.position.y = p.position[1] + Math.sin(state.clock.elapsedTime * p.speed + p.offset) * 0.4;
    });
  });

  return (
    <group ref={group}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[p.size, 12, 12]} />
          <meshStandardMaterial color={p.color} roughness={0.4} metalness={0.2} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// Scene that reads scroll progress from a shared value
const Scene = ({ progress }: { progress: number }) => {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} color="#fff5eb" />
      <pointLight position={[-3, 2, 4]} intensity={0.6} color="#f97316" />
      <pointLight position={[3, -2, 4]} intensity={0.4} color="#fb923c" />
      <Fork scrollProgress={progress} />
      <Knife scrollProgress={progress} />
      <Plate scrollProgress={progress} />
      <FoodParticles scrollProgress={progress} />
    </>
  );
};

interface ScrollCutlerySceneProps {
  className?: string;
}

export const ScrollCutleryScene = ({ className }: ScrollCutlerySceneProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // We need to bridge framer-motion's MotionValue into R3F
  // We'll use a ref that updates on scroll
  const progressRef = useRef(0);
  scrollYProgress.on("change", (v) => {
    progressRef.current = v;
  });

  return (
    <div ref={containerRef} className={className}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]}>
        <SceneBridge progressRef={progressRef} />
      </Canvas>
    </div>
  );
};

// Bridge component that reads the ref each frame
const SceneBridge = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const progressVal = useRef(0);
  useFrame(() => {
    progressVal.current = progressRef.current;
  });

  // We need to force re-render, so we use a state-like approach via useFrame
  // Actually, since Scene components use useFrame internally, they can read progressRef directly
  return <SceneWithRef progressRef={progressRef} />;
};

const SceneWithRef = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  // The child components will read progressRef in their own useFrame calls
  // But we need to pass the value. Let's use a simple approach:
  // We'll create a wrapper that passes progress via a context-like mechanism
  // Simplest: just render Scene with a dummy progress and let children read the ref
  
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} color="#fff5eb" />
      <pointLight position={[-3, 2, 4]} intensity={0.6} color="#f97316" />
      <pointLight position={[3, -2, 4]} intensity={0.4} color="#fb923c" />
      <ForkRef progressRef={progressRef} />
      <KnifeRef progressRef={progressRef} />
      <PlateRef progressRef={progressRef} />
      <FoodParticlesRef progressRef={progressRef} />
    </>
  );
};

// Ref-based versions that read from the mutable ref each frame
const ForkRef = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!group.current) return;
    const p = progressRef.current;
    group.current.rotation.y = p * Math.PI * 2;
    group.current.rotation.x = Math.sin(p * Math.PI) * 0.5;
    group.current.position.y = Math.sin(p * Math.PI * 2) * 0.3;
  });

  return (
    <group ref={group} position={[-2, 0, 0]}>
      <mesh position={[0, -1.2, 0]}>
        <capsuleGeometry args={[0.08, 2, 8, 16]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.95} roughness={0.1} />
      </mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0.8, 0]}>
          <capsuleGeometry args={[0.025, 0.8, 6, 12]} />
          <meshStandardMaterial color="#d4d4d4" metalness={0.95} roughness={0.08} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.06]} />
        <meshStandardMaterial color="#c8c8c8" metalness={0.9} roughness={0.12} />
      </mesh>
    </group>
  );
};

const KnifeRef = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!group.current) return;
    const p = progressRef.current;
    group.current.rotation.y = -p * Math.PI * 1.5;
    group.current.rotation.z = Math.cos(p * Math.PI) * 0.3;
    group.current.position.y = Math.cos(p * Math.PI * 2) * 0.3;
  });

  return (
    <group ref={group} position={[2, 0, 0]}>
      <mesh position={[0, -1.2, 0]}>
        <capsuleGeometry args={[0.08, 2, 8, 16]} />
        <meshStandardMaterial color="#b8b8b8" metalness={0.95} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.18, 1.2, 0.02]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.98} roughness={0.05} />
      </mesh>
    </group>
  );
};

const PlateRef = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!group.current) return;
    const p = progressRef.current;
    group.current.rotation.x = -Math.PI / 2 + Math.sin(p * Math.PI) * 0.2;
    group.current.rotation.z = p * Math.PI * 0.5;
    group.current.position.y = -0.5 + Math.sin(p * Math.PI) * 0.5;
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <mesh>
        <torusGeometry args={[1, 0.15, 16, 48]} />
        <meshStandardMaterial color="#f5f5f0" metalness={0.1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.04, 48]} />
        <meshStandardMaterial color="#fafaf5" metalness={0.05} roughness={0.4} />
      </mesh>
    </group>
  );
};

const FoodParticlesRef = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const group = useRef<THREE.Group>(null!);
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
      ] as [number, number, number],
      color: ["#f97316", "#ef4444", "#22c55e", "#eab308", "#f59e0b", "#10b981"][i % 6],
      size: 0.06 + Math.random() * 0.08,
      speed: 0.5 + Math.random() * 1.5,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = progressRef.current * Math.PI;
    group.current.children.forEach((child, i) => {
      const p = particles[i];
      if (p) {
        child.position.y = p.position[1] + Math.sin(state.clock.elapsedTime * p.speed + p.offset) * 0.4;
      }
    });
  });

  return (
    <group ref={group}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[p.size, 12, 12]} />
          <meshStandardMaterial color={p.color} roughness={0.4} metalness={0.2} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
};
