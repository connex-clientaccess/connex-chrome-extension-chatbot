const { OpenAI } = require("langchain/llms/openai");
const { NotionAPILoader } = require("langchain/document_loaders/web/notionapi");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RetrievalQAChain } = require("langchain/chains");
const { markdownToTxt } = require('markdown-to-txt');
const { Document } = require("langchain/document")
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*'
}));



const dbLoader = new NotionAPILoader({
    clientOptions: {
      auth:  process.env.NOTION_KEY //"secret_rDDgfCZA8nz6dC8gaPOhRE9V5fMzAKfWzzPWlwn9xlp",
    },
    id: process.env.NOTION_DB, //"8bc93032480943a189ccb6cf876393f8",
    type: "database",
  });

let dbDocs = []
let pageDocs = []

const pageLoader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_KEY,//DEV NOTION KEY "secret_rDDgfCZA8nz6dC8gaPOhRE9V5fMzAKfWzzPWlwn9xlp",
    },
    id: "ed3a2d6839e246cb8d3c4b1e28b135d2",
    type: "page",
  });

const model = new OpenAI({openAIApiKey: process.env.OPENAI_API_KEY});


app.use(express.json());


  app.post('/api/data', async (req, res) => {
    // const requestData = req.body;
    // res.json({ message: 'Data received successfully', data: requestData });
    const message_query = req.body
    try {
        const filtered = dbDocs.filter((doc) => doc.pageContent !== undefined)
        let array = []; //to store split documents
        filtered.forEach(async (document) => {
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 2000,
            chunkOverlap: 200
          })
          const text = markdownToTxt(document.pageContent)
          const text_output = await splitter.splitDocuments([
            new Document({ pageContent: text })
          ])
          array.push(text_output)
        })
        pageDocs.map(async (pageDoc) => {
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
          })
          const text = markdownToTxt(pageDoc.pageContent)
          const text_output = await splitter.splitDocuments([
            new Document({ pageContent: text })
          ])
          array.push(text_output)
        })
        array = [
          ...pageDocs
        ]
        
        const vectorStore = await MemoryVectorStore.fromDocuments(pageDocs, new OpenAIEmbeddings())
        
    
        const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
       
        const chainResult = await chain.call({
            query: message_query.message,
        });
        
         res.json({ data: chainResult.text });        
      }
      catch (error) {
        console.log(error);
      }
  
  });

  const startApp = async () => {
    try {
      // Start the Express app
      await app.listen(port);
      console.log(`App is listening on port ${port}`);
  
      // Load data and perform other initializations
      dbDocs = await dbLoader.load();
      console.log("DB LOG: ", JSON.stringify(dbDocs[0].metadata.properties))
      pageDocs = await pageLoader.loadAndSplit();
      
    } catch (error) {
      console.error('Error starting the app:', error);
    }
  };

  startApp();

