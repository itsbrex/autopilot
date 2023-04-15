const express = require('express');
const app = express();
const { main: doTask } = require('../ui');
const {execSync} = require('child_process')
const path = require('path')

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')))

app.post('/api/process-task', async (req, res) => {
  const task = req.body.task;

  if (!task) {
    return res.status(400).json({ error: 'Task is required' });
  }
  try {
    // TODO: Implement call to your GPT function here
    const response = await doTask(task);

    res.json({ result: response});
  } catch (error) {
    console.log(error)
    res.status(500).json(error);
  }
});


function runCI () {
  let ciSuccess
  try {
    // Execute the 'npm start' command synchronously
    const output = execSync('npm test', { stdio: 'inherit' });
    // If the command completes successfully, this line will be reached
    console.log('npm start command completed successfully');
    ciSuccess = true
  } catch (error) {
    // If an error occurs during execution, the catch block will be executed
    console.error(`npm start command failed with exit code ${error.status}`);
    ciSuccess = false
  }
}

function commitChanges(issueTitle, issueDescription, issueNumber){
  try {
    // Create new branch
    execSync(`git checkout -b issue-${issueNumber}`)
    console.log('Branch Created');

    // Stage all changes synchronously
    execSync('git add .');
    console.log('Changes staged successfully.');

    // Commit the staged changes synchronously
    execSync(`git commit -m "${issueTitle}"`);
    console.log('Changes committed successfully.');

    // Push branch
    execSync(`git push --set-upstream origin issue-${issueNumber}`)

    // Open PR
    execSync(`gh pr create --title "(auto) Issue: ${issueTitle}" --body "Task: ${issueDescription} \n Solves issue #${issueNumber}" \n GENERATED BY AUTOPILOT`);
    console.log("PR Opened 👍")
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }

}

async function processIssue(issue) {
  const title = issue.title.replace(/"/g, '\\"');
  const description = issue.body.replace(/"/g, '\\"');
  const number = issue.number;
  const task = "title: " + title + "\ndescription: " + description;
  console.log("STARTING A NEW TASK!");
  await doTask(task);
  runCI();
  commitChanges(title, description, number);
}

// Route to handle incoming webhook events
app.post('/issue', async (req, res) => {
  try {
    const event = req.body;
    console.log('Received webhook event:', event);

    if (event.action === 'opened' && event.issue && event.issue.title && event.issue.body) {
      console.log('NEW ISSUE')
      res.status(200).send('Working on issue');
      await processIssue(event.issue);
    } else if (event.action === 'labeled' && event.label && event.label.name === 'autopilot' && event.issue && event.issue.title && event.issue.body) {
      console.log('ISSUE WITH LABEL')
      res.status(200).send('Working on issue');
      await processIssue(event.issue);
    } else {
      res.status(200).send('Issue doesn\'t qualify');
      console.log('Issue doesn\'t qualify')
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    res.status(500).send('Error processing webhook event');
  }
});

function initApp() {
  execSync('git init')
  execSync('git remote add origin https://github.com/fjrdomingues/autopilot.git')
  execSync('git fetch origin');
  execSync('git checkout origin/main');
  execSync('git config --global user.email "fjrdomingues@gmail.com"');
  execSync('git config --global user.name "Fabio Domingues"');
  execSync('node createSummaryOfFiles --all --auto')
}

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

initApp()