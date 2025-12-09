import { createServer } from "node:http"

const server = createServer().on("request", (req, res) => {
    res.write("Hello World!")
    res.end()
})

const port = Number.parseInt(process.env.PORT || 4444)
server.listen(port, () => {
    console.log(`Hello-Server started on port ${port}.`)
})
