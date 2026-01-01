const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { getTopSongsBySinger } = require("./openai");

dotenv.config();
const PORT=process.env.PORT


const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/songs",async (req,res)=>{
    const {singer}=req.body
       if (!singer) {
      return res.status(400).json({ error: "Singer is required" });
    }
    const songs=await getTopSongsBySinger(singer)
    res.json({songs})
    
})


app.listen(PORT,()=>{
    console.log("server running on port 3001")
})
