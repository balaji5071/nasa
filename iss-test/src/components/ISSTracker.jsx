import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Shaders for Day/Night Earth ---
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;

    vec3 worldNormal = normalize(vNormal);
    float lightIntensity = max(0.0, dot(worldNormal, sunDirection));
    
    float dayNightMix = smoothstep(-0.05, 0.15, lightIntensity);

    vec3 finalColor = mix(nightColor, dayColor, dayNightMix);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// --- ISS Model Creator ---
const createIssModel = () => {
  const issGroup = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.4 });
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x003366, metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), bodyMaterial);
  issGroup.add(body);

  const panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.01), panelMaterial);
  panel1.position.x = 0.5;
  issGroup.add(panel1);

  const panel2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.01), panelMaterial);
  panel2.position.x = -0.5;
  issGroup.add(panel2);

  issGroup.scale.set(0.2, 0.2, 0.2);
  return issGroup;
};

const DataItem = ({ label, value }) => (
  <div className="data-item">
    <span className="data-label">{label}:</span>
    <span className="data-value">{value}</span>
  </div>
);

export default function ISSTracker() {
  const [issData, setIssData] = useState(null);
  const [error, setError] = useState(null);

  const mountRef = useRef(null);
  const issMeshRef = useRef(null);
  const orbitLineRef = useRef(null);
  const rendererRef = useRef(null);
  const earthMaterialRef = useRef(null);
  const earthMeshRef = useRef(null);
  const sunLightRef = useRef(null);

  const API_URL_ISS = 'https://api.wheretheiss.at/v1/satellites/25544';

  const fetchISSData = async () => {
    try {
      const response = await fetch(API_URL_ISS);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setIssData(data);
      setError(null);

      const { latitude, longitude, altitude } = data;
      const phi = (90 - latitude) * (Math.PI / 180);
      const theta = (longitude + 180) * (Math.PI / 180);
      const issRadius = 2.1 + altitude / 6371;

      if (issMeshRef.current) {
        const issPosition = new THREE.Vector3().setFromSphericalCoords(issRadius, phi, theta);
        issMeshRef.current.position.copy(issPosition);
        issMeshRef.current.lookAt(new THREE.Vector3(0, 0, 0));
      }

      if (orbitLineRef.current) {
        const points = orbitLineRef.current.geometry.attributes.position
          ? Array.from(orbitLineRef.current.geometry.attributes.position.array)
          : [];
        points.push(issMeshRef.current.position.x, issMeshRef.current.position.y, issMeshRef.current.position.z);
        if (points.length > 3000) points.splice(0, 3);
        orbitLineRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        orbitLineRef.current.geometry.attributes.position.needsUpdate = true;
      }

    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch ISS data:", err);
    }
  };

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020916);

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xcccccc, 0.3));

    const sunLight = new THREE.PointLight(0xffffff, 2, 100);
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    // Earth
    const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    earthMaterialRef.current = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        dayTexture: { value: textureLoader.load('https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg') },
        nightTexture: { value: textureLoader.load('https://threejs.org/examples/textures/earth_nightmap.jpg') },
        sunDirection: { value: new THREE.Vector3(0, 0, 1) }
      }
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterialRef.current);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // Clouds
    const cloudGeometry = new THREE.SphereGeometry(2.03, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({ map: textureLoader.load('https://threejs.org/examples/textures/earth_cloudmap.png'), transparent: true, opacity: 0.4 });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(cloudMesh);

    // ISS
    const issModel = createIssModel();
    issMeshRef.current = issModel;
    scene.add(issModel);

    const spriteMaterial = new THREE.SpriteMaterial({ map: textureLoader.load('https://threejs.org/examples/textures/sprites/disc.png'), color: 0x00ffff, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.5 });
    const issGlow = new THREE.Sprite(spriteMaterial);
    issGlow.scale.set(0.5, 0.5, 1.0);
    issModel.add(issGlow);

    // Orbit line
    const orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([]), new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 }));
    orbitLineRef.current = orbitLine;
    scene.add(orbitLine);

    // Camera & controls
    camera.position.z = 5;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 10;

    const animate = () => {
      requestAnimationFrame(animate);
      const date = new Date();
      const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
      const sunAngle = (utcHour / 24) * Math.PI * 2 - Math.PI / 2;
      const sunDirection = new THREE.Vector3(Math.cos(sunAngle), 0, Math.sin(sunAngle)).normalize();

      if (earthMaterialRef.current) earthMaterialRef.current.uniforms.sunDirection.value = sunDirection;
      if (sunLightRef.current) sunLightRef.current.position.copy(sunDirection).multiplyScalar(10);
      earthMesh.rotation.y += 0.0002;
      cloudMesh.rotation.y += 0.0003;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (mountRef.current) {
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    fetchISSData();
    const intervalId = setInterval(fetchISSData, 5000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) mountRef.current.removeChild(rendererRef.current.domElement);
    };
  }, []);

  return (
    <div className="tracker-container">
      <div ref={mountRef} className="three-canvas" style={{ width: '100%', height: '500px' }}></div>
      <div className="data-panel">
        <h2>Live ISS Data</h2>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
        {issData ? (
          <div>
            <DataItem label="Latitude" value={issData.latitude.toFixed(4)} />
            <DataItem label="Longitude" value={issData.longitude.toFixed(4)} />
            <DataItem label="Altitude" value={`${issData.altitude.toFixed(2)} km`} />
            <DataItem label="Speed" value={`${issData.velocity.toFixed(2)} km/h`} />
            <DataItem label="Visibility" value={issData.visibility} />
          </div>
        ) : <p>Fetching ISS data...</p>}
      </div>
    </div>
  );
}
