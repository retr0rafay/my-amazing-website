import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Blog from './pages/Blog'
import ArticlePage from './pages/ArticlePage'
import Gaming from './pages/Gaming'
import MyLife from './pages/MyLife'

const RafayHaven = lazy(() => import('./pages/RafayHaven'))
const RafayBot = lazy(() => import('./pages/RafayBot'))

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
              <Route path="gaming" element={<Gaming />} />
              <Route path="my-life" element={<MyLife />} />
              <Route
                path="rafay-haven"
                element={(
                  <Suspense fallback={null}>
                    <RafayHaven />
                  </Suspense>
                )}
              />
              <Route
                path="rafay-bot"
                element={(
                  <Suspense fallback={null}>
                    <RafayBot />
                  </Suspense>
                )}
              />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
