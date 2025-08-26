import React, { useState, useEffect, useRef } from 'react';
import { Globe, History, Bot, X, Rocket, Clock, Cloud, MapPin } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const API_URL_ISS = 'https://api.wheretheiss.at/v1/satellites/25544';

// --- Generic Gemini API Caller ---
const callGeminiAPI = async (prompt, retries = 3, delay = 1000) => {
    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    if (!apiKey) {
        const errorMsg = "API key is missing. Please create a .env.local file and add your VITE_GEMINI_API_KEY.";
        console.error(errorMsg);
        return errorMsg;
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429 && retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return callGeminiAPI(prompt, retries - 1, delay * 2);
            }
            throw new Error(`API responded with status: ${response.status}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error("Unexpected API response structure:", result);
            return "I couldn't find a clear answer for that. Could you try rephrasing?";
        }
    } catch (error) {
         console.error("Error calling Gemini API:", error);
         if (retries > 0) {
            await new Promise(res => setTimeout(res, delay));
            return callGeminiAPI(prompt, retries - 1, delay * 2);
         }
         throw error;
    }
};


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
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const panelMaterial = new THREE.MeshBasicMaterial({ color: 0x003366, side: THREE.DoubleSide });
    
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
        <span className="data-label">
            {label}:
        </span>
        <span className="data-value">{value}</span>
    </div>
);


export default function ISSTracker() {
    const [issData, setIssData] = useState(null);
    const [error, setError] = useState(null);
    
    const mountRef = useRef(null);
    const issMeshRef = useRef(null);
    const orbitLineRef = useRef(null);
    const groundTrackLineRef = useRef(null); 
    const rendererRef = useRef(null);
    const earthMaterialRef = useRef(null);
    const sunLightRef = useRef(null);

    useEffect(() => {
        const currentMount = mountRef.current; // Capture mount point for cleanup

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x020916);
        const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        currentMount.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        
        scene.add(new THREE.AmbientLight(0xffffff, 0.6)); 
        
        const sunLight = new THREE.PointLight(0xffffff, 1.5, 100);
        sunLightRef.current = sunLight;
        scene.add(sunLight);
        const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        earthMaterialRef.current = new THREE.ShaderMaterial({
            vertexShader, fragmentShader,
            uniforms: {
                dayTexture: { value: textureLoader.load('https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg') },
                nightTexture: { value: textureLoader.load('https://threejs.org/examples/textures/earth_nightmap.jpg') },
                sunDirection: { value: new THREE.Vector3(0, 0, 1) }
            }
        });
        const earthMesh = new THREE.Mesh(earthGeometry, earthMaterialRef.current);
        scene.add(earthMesh);
        const cloudGeometry = new THREE.SphereGeometry(2.03, 64, 64);
        const cloudMaterial = new THREE.MeshPhongMaterial({ map: textureLoader.load('https://threejs.org/examples/textures/earth_cloudmap.png'), transparent: true, opacity: 0.4 });
        const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        scene.add(cloudMesh);
        
        const issModel = createIssModel();
        issMeshRef.current = issModel;
        scene.add(issModel);

        const spriteMaterial = new THREE.SpriteMaterial({ map: textureLoader.load('https://threejs.org/examples/textures/sprites/disc.png'), color: 0x00ffff, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.5 });
        const issGlow = new THREE.Sprite(spriteMaterial);
        issGlow.scale.set(0.5, 0.5, 1.0);
        issModel.add(issGlow);
        
        const orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([]), new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 }));
        orbitLineRef.current = orbitLine;
        scene.add(orbitLine);
        const groundTrackLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([]), new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 }));
        groundTrackLineRef.current = groundTrackLine;
        scene.add(groundTrackLine);
        camera.position.z = 5;
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;
        controls.minDistance = 3; controls.maxDistance = 10;
        const animate = () => {
            requestAnimationFrame(animate);
            const date = new Date();
            const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
            const sunAngle = (utcHour / 24) * Math.PI * 2 - Math.PI / 2;
            const sunDirection = new THREE.Vector3().set(Math.cos(sunAngle), 0, Math.sin(sunAngle)).normalize();
            if (earthMaterialRef.current) earthMaterialRef.current.uniforms.sunDirection.value = sunDirection;
            if (sunLightRef.current) sunLightRef.current.position.copy(sunDirection).multiplyScalar(10);
            
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
        const handleResize = () => {
            if (currentMount) {
                camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
            }
        };
        window.addEventListener('resize', handleResize);
        
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
                    issMeshRef.current.lookAt(new THREE.Vector3(0,0,0));
                }

                if (orbitLineRef.current) {
                    const points = orbitLineRef.current.geometry.attributes.position ? Array.from(orbitLineRef.current.geometry.attributes.position.array) : [];
                    points.push(issMeshRef.current.position.x, issMeshRef.current.position.y, issMeshRef.current.position.z);
                    if (points.length > 3000) points.splice(0, 3);
                    orbitLineRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
                    orbitLineRef.current.geometry.attributes.position.needsUpdate = true;
                }
                if (groundTrackLineRef.current) {
                    const groundTrackRadius = 2.01;
                    const groundPosition = new THREE.Vector3().setFromSphericalCoords(groundTrackRadius, phi, theta);
                    const points = groundTrackLineRef.current.geometry.attributes.position ? Array.from(groundTrackLineRef.current.geometry.attributes.position.array) : [];
                    points.push(groundPosition.x, groundPosition.y, groundPosition.z);
                    if (points.length > 3000) points.splice(0, 3);
                    groundTrackLineRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
                    groundTrackLineRef.current.geometry.attributes.position.needsUpdate = true;
                }

            } catch (err) { setError(err.message); console.error("Failed to fetch ISS data:", err); }
        };

        fetchISSData();
        const intervalId = setInterval(fetchISSData, 5000);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', handleResize);
            // FIX: Ensure cleanup happens correctly
            if (currentMount && rendererRef.current) {
                currentMount.removeChild(rendererRef.current.domElement);
            }
        };
    }, []);


    return (
        <div className="tracker-container">
            <div ref={mountRef} className="three-canvas"></div>
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
                ) : <p>Fetching ISS data...</p> }
            </div>
        </div>
    );
};
