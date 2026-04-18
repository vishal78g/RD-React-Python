import './env.js'
import app from './app.js'

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  console.log(`RD backend running on http://localhost:${port}`)
})
