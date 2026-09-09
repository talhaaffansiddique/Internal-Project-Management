import './App.css'
import { useAuth } from './auth'
import Login from './pages/Login'
import AdminApp from './AdminApp'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="login-wrap">
        <p className="muted">Loading…</p>
      </div>
    )
  }
  if (!user) return <Login />
  return <AdminApp />
}
