const dotenv=require("dotenv")

dotenv.config()

const { getTopSongsBySinger } = require("./openai");


(async()=>{
    try {
        const songs= await getTopSongsBySinger("Noa Kerl")
        
        console.log(`This is the result ${songs}`)
        
    } catch (error) {
        console.log(`Error in fetching songs ${error}`)
    }
})();