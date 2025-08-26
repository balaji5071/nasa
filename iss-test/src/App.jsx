import React, { useState } from 'react';
import { Globe, History, Bot } from 'lucide-react';
import ISSTracker from './components/ISSTracker';
import NasaHistory from './components/NasaHistory';
import NasaChatbot from './components/NasaChatbot';
import './App.css'; // Import the new CSS file

const Header = ({ activePage, setActivePage }) => {
    const navItems = [
        { id: 'tracker', icon: Globe, label: 'ISS Tracker' },
        { id: 'history', icon: History, label: 'NASA History' },
        { id: 'chatbot', icon: Bot, label: 'AI Chatbot' },
    ];

    return (
        <header className="header">
            <nav className="nav-container">
                <div className="logo-container">
                    <img src="https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg" alt="NASA Logo" />
                    <span>ISS Command Center</span>
                </div>
                <div className="nav-links">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActivePage(item.id)}
                            className={`nav-button ${activePage === item.id ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </header>
    );
};

const Footer = () => (
    <footer className="footer">
        <p>&copy; {new Date().getFullYear()} ISS Command Center. All data sourced from public APIs. Not affiliated with NASA.</p>
    </footer>
);


export default function App() {
    const [activePage, setActivePage] = useState('tracker');

    const renderPage = () => {
        switch (activePage) {
            case 'tracker':
                return <ISSTracker />;
            case 'history':
                return <NasaHistory />;
            case 'chatbot':
                return <NasaChatbot />;
            default:
                return <ISSTracker />;
        }
    };

    return (
        <div className="app-container">
            <Header activePage={activePage} setActivePage={setActivePage} />
            <main className="main-content">
                {renderPage()}
            </main>
            <Footer />
        </div>
    );
}
