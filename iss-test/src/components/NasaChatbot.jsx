import React, { useState, useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';

const callGeminiAPI = async (prompt, retries = 3, delay = 1000) => {
    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiKey = "AIzaSyA7Cs2VMfGKs431nHym0dJfIYbAcBd0ITU" ; // API key will be handled by the environment
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

export default function NasaChatbot() {
    const [messages, setMessages] = useState([{ text: "Hello! I'm an AI expert on NASA's history. Ask me anything about missions, astronauts, or discoveries!", sender: 'bot' }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;
        const userMessage = { text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);
        try {
            const prompt = `You are a helpful and knowledgeable assistant specializing in NASA's history. Answer the following question concisely and accurately. Question: ${currentInput}`;
            const botResponseText = await callGeminiAPI(prompt);
            const botMessage = { text: botResponseText, sender: 'bot' };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error("Failed to get response from AI:", error);
            const errorMessage = { text: "Sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment.", sender: 'bot' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="chatbot-container-wrapper">
            <h1 className="page-title">NASA History AI Chatbot</h1>
            <div className="chatbot-container">
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`message-row ${msg.sender}`}>
                            {msg.sender === 'bot' && <Bot size={32} />}
                            <div className="message-bubble">
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message-row bot">
                            <Bot size={32} />
                            <div className="message-bubble">
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                <div className="chat-input-area">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about the Apollo missions, JWST, etc..."
                        className="chat-input"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        className="chat-send-button"
                        disabled={isLoading}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
