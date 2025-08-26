import React, { useState } from 'react';
import { X, Rocket } from 'lucide-react';

const callGeminiAPI = async (prompt, retries = 3, delay = 1000) => {
    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiKey = "AIzaSyA7Cs2VMfGKs431nHym0dJfIYbAcBd0ITU" 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

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

export default function NasaHistory() {
    const [modalContent, setModalContent] = useState(null);
    const [isLoadingModal, setIsLoadingModal] = useState(false);
    const historyData = [
        { year: 1998, event: "ISS construction begins with the launch of the Zarya module." },
        { year: 2000, event: "Expedition 1 crew arrives, marking permanent human presence." },
        { year: 2009, event: "Station crew size increases to six members." },
        { year: 2011, event: "Final Space Shuttle mission, STS-135, completes assembly." },
        { year: 2020, event: "SpaceX Crew-1, the first operational commercial crew mission, docks." },
        { year: 2021, event: "James Webb Space Telescope launched on an Ariane 5 rocket." },
        { year: 2022, event: "Artemis I mission launches, an uncrewed test flight around the Moon." },
        { year: 2024, event: "Planned launch of the Europa Clipper mission to Jupiter's moon." }
    ];

    const handleLearnMore = async (item) => {
        setIsLoadingModal(true);
        setModalContent({ year: item.year, event: item.event, details: 'Generating details...' });
        const prompt = `Provide a detailed, engaging summary of the following NASA-related event: "${item.event}". Explain its significance and key objectives.`;
        try {
            const details = await callGeminiAPI(prompt);
            setModalContent({ ...item, details });
        } catch (e) {
            setModalContent({ ...item, details: 'Could not load details at this time.' });
        } finally {
            setIsLoadingModal(false);
        }
    };

    return (
        <div className="history-container">
            <h1 className="page-title">25 Years of NASA & ISS History</h1>
            <div className="timeline">
                {historyData.map((item, index) => (
                    <div key={index} className={`timeline-item ${index % 2 === 0 ? 'left' : 'right'}`}>
                        <div className="timeline-spacer"></div>
                        <div className="timeline-circle">{index + 1}</div>
                        <div className="timeline-item-content">
                            <h3>{item.year}</h3>
                            <p>{item.event}</p>
                            <button onClick={() => handleLearnMore(item)} className="panel-button">
                                ✨ Learn More
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {modalContent && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{modalContent.year}: {modalContent.event}</h2>
                            <button onClick={() => setModalContent(null)} className="modal-close-button"><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            {isLoadingModal ? (
                                <div className="modal-loader">
                                    <Rocket size={48} />
                                </div>
                            ) : (
                                <p>{modalContent.details}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
