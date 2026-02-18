import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Blog from './pages/Blog'
import ArticlePage from './pages/ArticlePage'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:slug" element={<ArticlePage />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
