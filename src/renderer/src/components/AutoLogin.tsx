// Example: AutoLoginButton.tsx
import React from 'react'

declare global {
  interface Window {
    electronAPI: {
      autoLogin: (payload: { url: string; username: string; password: string }) => Promise<any>
    }
  }
}

const AutoLoginButton: React.FC = () => {
  const handleClick = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.autoLogin({
        url: 'https://facebook.com/login', // your target
        username: 'yourusername',
        password: 'yourpassword' // use input fields in real app!
      })
      console.log('Result:', result)
      alert(result.success ? 'Login attempted!' : `Error: ${result.error}`)
    } catch (err) {
      console.error(err)
      alert('Failed to trigger auto-login')
    }
  }

  return <button onClick={handleClick}>Auto Login to Site</button>
}

export default AutoLoginButton
