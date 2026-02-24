import { useState } from 'react'
import './App.css'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'

function App() {
    const [count, setCount] = useState(0)

    return (
        <div className="App">
            <Header />
            <Hero />
        </div>
    )
}

export default App