const { Octokit } = require("@octokit/rest");
const fs = require("fs");

exports.handler = async (event, context) => {
  const today = new Date().toISOString().split("T")[0];
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  // Lire le planning depuis GitHub
  const { data: planningData } = await octokit.repos.getContent({
    owner: "mpbiolab",
    repo: "reta-site",
    path: "planning.json"
  });
  
  const planning = JSON.parse(Buffer.from(planningData.content, "base64").toString());
  const todayArticle = planning.find(a => a.date === today && !a.published);
  
  if (!todayArticle) {
    return { statusCode: 200, body: "No article to publish today" };
  }
  
  // Lire l'article depuis GitHub (dossier articles_queue)
  const { data: articleData } = await octokit.repos.getContent({
    owner: "mpbiolab",
    repo: "reta-site",
    path: `articles_queue/${todayArticle.file}`
  });
  
  // Publier dans /blog/
  await octokit.repos.createOrUpdateFileContents({
    owner: "mpbiolab",
    repo: "reta-site",
    path: `blog/${todayArticle.file}`,
    message: `Publish: ${todayArticle.slug}`,
    content: articleData.content
  });
  
  // Marquer comme publié dans planning.json
  todayArticle.published = true;
  await octokit.repos.createOrUpdateFileContents({
    owner: "mpbiolab",
    repo: "reta-site",
    path: "planning.json",
    message: `Mark published: ${todayArticle.slug}`,
    content: Buffer.from(JSON.stringify(planning, null, 2)).toString("base64"),
    sha: planningData.sha
  });
  
  return { statusCode: 200, body: `Published: ${todayArticle.slug}` };
};
