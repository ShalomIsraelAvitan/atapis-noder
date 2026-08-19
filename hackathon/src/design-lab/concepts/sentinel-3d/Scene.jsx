import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { riskTone } from '../../shared/adapter'

// World mapping: radar sits at the origin, the scanned field extends toward -Z.
// 1 world unit = 1 meter. Lateral x_mm/1000, forward y_mm/1000 (capped 8m).
const FIELD_DEPTH = 8
const FIELD_HALF_WIDTH = 3.4

const TONE_COLORS = { safe: '#34c76f', alert: '#f5a623', danger: '#f0402e' }

function targetWorldPosition(target) {
  const x = THREE.MathUtils.clamp(target.xMm / 1000, -FIELD_HALF_WIDTH, FIELD_HALF_WIDTH)
  const z = -THREE.MathUtils.clamp(target.yMm / 1000, 0, FIELD_DEPTH)
  return new THREE.Vector3(x, 0, z)
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -FIELD_DEPTH / 2 + 0.5]}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2 + 2, FIELD_DEPTH + 2]} />
        <meshStandardMaterial color="#0a1120" roughness={1} metalness={0} />
      </mesh>
      <gridHelper
        args={[16, 32, '#1c2c4a', '#13203a']}
        position={[0, -0.01, -FIELD_DEPTH / 2 + 0.5]}
      />
    </group>
  )
}

// SAFE / WARNING / DANGER bands on the ground (operational zones, not geo data).
function Zones() {
  const zones = [
    { from: 0, to: 2, color: '#f0402e', opacity: 0.1 },
    { from: 2, to: 4, color: '#f5a623', opacity: 0.07 },
    { from: 4, to: FIELD_DEPTH, color: '#34c76f', opacity: 0.05 },
  ]
  return (
    <group>
      {zones.map((zone) => (
        <mesh
          key={zone.color}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, -(zone.from + zone.to) / 2]}
        >
          <planeGeometry args={[FIELD_HALF_WIDTH * 2, zone.to - zone.from]} />
          <meshBasicMaterial color={zone.color} transparent opacity={zone.opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function FenceAndGate() {
  const posts = useMemo(() => {
    const list = []
    for (let x = -FIELD_HALF_WIDTH; x <= FIELD_HALF_WIDTH; x += 0.85) {
      if (Math.abs(x) < 0.65) continue // gate opening
      list.push(x)
    }
    return list
  }, [])
  return (
    <group position={[0, 0, 0.35]}>
      {posts.map((x) => (
        <mesh key={x} position={[x, 0.35, 0]}>
          <boxGeometry args={[0.06, 0.7, 0.06]} />
          <meshStandardMaterial color="#3d4a63" roughness={0.8} />
        </mesh>
      ))}
      {/* fence rail */}
      <mesh position={[-(FIELD_HALF_WIDTH + 0.65) / 2 - 0.325, 0.62, 0]}>
        <boxGeometry args={[FIELD_HALF_WIDTH - 0.65, 0.04, 0.04]} />
        <meshStandardMaterial color="#3d4a63" roughness={0.8} />
      </mesh>
      <mesh position={[(FIELD_HALF_WIDTH + 0.65) / 2 + 0.325, 0.62, 0]}>
        <boxGeometry args={[FIELD_HALF_WIDTH - 0.65, 0.04, 0.04]} />
        <meshStandardMaterial color="#3d4a63" roughness={0.8} />
      </mesh>
      {/* gate pillars */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.55, 0]}>
          <boxGeometry args={[0.12, 1.1, 0.12]} />
          <meshStandardMaterial color="#5a6b8c" roughness={0.6} />
        </mesh>
      ))}
      <Billboard position={[0, 1.35, 0]}>
        <Text fontSize={0.22} color="#8fa3c8" anchorX="center" anchorY="middle">
          GATE
        </Text>
      </Billboard>
    </group>
  )
}

function SensorPylons() {
  return (
    <group position={[0, 0, 0.9]}>
      {/* camera mast */}
      <group position={[-1.4, 0, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 1.2, 8]} />
          <meshStandardMaterial color="#6b7a99" />
        </mesh>
        <mesh position={[0, 1.25, -0.08]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.22, 0.14, 0.3]} />
          <meshStandardMaterial color="#9fb0d0" />
        </mesh>
        <Billboard position={[0, 1.62, 0]}>
          <Text fontSize={0.16} color="#8fa3c8">CAM</Text>
        </Billboard>
      </group>
      {/* radar mast */}
      <group position={[1.3, 0, -0.4]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.9, 8]} />
          <meshStandardMaterial color="#6b7a99" />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.3, 0.2, 0.08]} />
          <meshStandardMaterial color="#b9c6e0" emissive="#2a4a80" emissiveIntensity={0.6} />
        </mesh>
        <Billboard position={[0, 1.3, 0]}>
          <Text fontSize={0.16} color="#8fa3c8">RADAR</Text>
        </Billboard>
      </group>
    </group>
  )
}

function RangeRings() {
  return (
    <group position={[0, 0.005, 0.5]}>
      {[2, 4, 6, 8].map((radius) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius - 0.015, radius + 0.015, 64, 1, Math.PI, Math.PI]} />
          <meshBasicMaterial color="#2c4472" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ±45° scan sector + sweeping line (paused under reduced motion).
function ScanCone({ animate, connected }) {
  const sweepRef = useRef()
  useFrame(({ clock }) => {
    if (!sweepRef.current || !animate || !connected) return
    const t = clock.getElapsedTime()
    // ping-pong between -45° and +45°
    const angle = Math.sin(t * 0.7) * (Math.PI / 4)
    sweepRef.current.rotation.y = angle
  })
  return (
    <group position={[0, 0.01, 0.5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FIELD_DEPTH, 48, Math.PI / 4, Math.PI / 2]} />
        <meshBasicMaterial
          color={connected ? '#1f4d8f' : '#333a45'}
          transparent
          opacity={connected ? 0.1 : 0.05}
          depthWrite={false}
        />
      </mesh>
      <group ref={sweepRef}>
        <mesh position={[0, 0, -FIELD_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.03, FIELD_DEPTH]} />
          <meshBasicMaterial color="#4d8fe6" transparent opacity={connected ? 0.55 : 0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function TargetMarker({ target, selected, onSelect, animate }) {
  const groupRef = useRef()
  const ringRef = useRef()
  const desired = targetWorldPosition(target)
  const tone = riskTone(target.risk)
  const color = TONE_COLORS[tone]

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (animate) {
      groupRef.current.position.lerp(desired, Math.min(delta * 2.2, 1))
    } else {
      groupRef.current.position.copy(desired)
    }
    if (ringRef.current && animate && (target.approachingGate || tone === 'danger')) {
      const s = 1 + 0.18 * Math.sin(performance.now() / 240)
      ringRef.current.scale.setScalar(s)
    }
  })

  return (
    <group ref={groupRef} position={desired}>
      <mesh
        position={[0, 0.42, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(target.id)
        }}
      >
        <capsuleGeometry args={[0.13, 0.5, 4, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.9 : 0.35}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.28, 0.34, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {target.approachingGate ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.42, 0.45, 32]} />
          <meshBasicMaterial color={TONE_COLORS.alert} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ) : null}
      <Billboard position={[0, 1.05, 0]}>
        <Text fontSize={0.19} color={color} anchorX="center">
          {`T${target.id} · ${(target.distanceMm / 1000).toFixed(1)}m`}
        </Text>
      </Billboard>
    </group>
  )
}

const OVERVIEW_POS = new THREE.Vector3(6.2, 6.4, 5.4)
const OVERVIEW_LOOK = new THREE.Vector3(0, 0, -3.2)

function CameraRig({ mode, focusTarget, animate }) {
  const { camera } = useThree()
  const lookRef = useRef(OVERVIEW_LOOK.clone())

  useFrame((_, delta) => {
    const factor = animate ? Math.min(delta * 2, 1) : 1
    let desiredPos = OVERVIEW_POS
    let desiredLook = OVERVIEW_LOOK
    if (mode === 'focus' && focusTarget) {
      const targetPos = targetWorldPosition(focusTarget)
      desiredPos = targetPos.clone().add(new THREE.Vector3(2.0, 2.2, 2.6))
      desiredLook = targetPos.clone().setY(0.4)
    }
    camera.position.lerp(desiredPos, factor)
    lookRef.current.lerp(desiredLook, factor)
    camera.lookAt(lookRef.current)
  })
  return null
}

export default function SentinelScene({ radar, selectedId, onSelect, cameraMode, animate }) {
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const focusTarget =
    radar.targets.find((t) => t.id === selectedId) ||
    (radar.targets.length
      ? radar.targets.reduce((a, b) => (b.risk > a.risk ? b : a))
      : null)

  // Pause rendering entirely when the tab is hidden; drop to demand-rendering
  // under reduced motion (data updates still repaint via prop changes).
  const frameloop = !visible ? 'never' : animate ? 'always' : 'demand'

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={frameloop}
      camera={{ position: OVERVIEW_POS.toArray(), fov: 46, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#06080c']} />
      <fog attach="fog" args={['#06080c', 14, 30]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 4]} intensity={0.9} />
      <Ground />
      <Zones />
      <RangeRings />
      <ScanCone animate={animate} connected={radar.connected} />
      <FenceAndGate />
      <SensorPylons />
      {radar.targets.map((target) => (
        <TargetMarker
          key={target.id}
          target={target}
          selected={selectedId === target.id}
          onSelect={onSelect}
          animate={animate}
        />
      ))}
      <CameraRig mode={cameraMode} focusTarget={focusTarget} animate={animate} />
    </Canvas>
  )
}
