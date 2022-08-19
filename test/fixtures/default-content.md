# Getting started with Helix - Developer Tutorial

This tutorial should have you up and running with your AEM Helix projects in 10 - 20 minutes to a place where you can create, preview and publish your own content and create your styling and add new blocks.

Pre-requisites:

1.  You have a github account, and understand git basics
2.  You have a google account
3.  You understand the basic HTML, CSS and JavaScript
4.  Have node/npm installed for local development

This tutorial assumes that you are using MacOS, Chrome and Visual Studio Code as part of your development environment.\
Of course you can use a different operating system, browser and code editor, but you will see that screenshots and default instructions are most compatible with that setup.

## Get started with the Helix Boilerplate Repository Template

[https://main--helix-website--adobe.hlx.page/media\_1d6e3d8e0e465fb2c43cdcb4c6ba8123693c86117.mp4](./media_1d6e3d8e0e465fb2c43cdcb4c6ba8123693c86117.mp4)

The fastest and easiest way to get started with all the best practices in AEM Helix is to create your repo using the helix boilerplate github repo as a template:

<https://github.com/adobe/helix-project-boilerplate>

![](./media_165bab297e15a33f4742a4f20d8e0a3c3ba42511a.png?width=750\&format=png\&optimize=medium)

Just click the `Use this Template` button, and select where you want to create this repo.

![](./media_15a342b8fddee4d58a6b5cdda64c13e785525a366.png?width=750\&format=png\&optimize=medium)

We recommend that the repo stays public by default.

The only step that’s left to get you all setup in github is to install the [Helix Bot](https://github.com/apps/helix-bot) on your repo, by visiting this link: <https://github.com/apps/helix-bot/installations/new>

![](./media_15c1f25fc4f11bd34bb63ea9f0c99974be835b484.png?width=750\&format=png\&optimize=medium)

Make sure you select `Only select Repositories` (NOT` All Repositories`).\
Select your newly created repo, and hit save.

Congrats you are done, and have a new website running on `https://<branch>--<repo>--<owner>.hlx.page/` in the above example that’s `https://main--my-website--davidnuescheler.hlx.page/`

![](./media_1ea0bbbcde0c84f710fa79b6a08a2f146935aaa45.png?width=750\&format=png\&optimize=medium)

## Link your own content source (Google Drive)

[https://main--helix-website--adobe.hlx.page/media\_1b16be8d758ce2d392315a7c306767a62516fa831.mp4](./media_1b16be8d758ce2d392315a7c306767a62516fa831.mp4)

In your fork the content points to an existing content source in gdrive, see [this folder](https://drive.google.com/drive/folders/1MGzOt7ubUh3gu7zhZIPb7R7dyRzG371j) with some example content in it.

This content is read-only, but it can be copied into your google drive folder.

![](./media_1f81f632a43133455d59aa16af3b48cf1eee5a773.png?width=750\&format=png\&optimize=medium)

To get started creating your own content, create a folder in your gdrive and share the folder with the Helix Bot (`helix@adobe.com`).

![](./media_1a25f536986e81a9ec28e8a67e30ea6dc145e79e0.png?width=750\&format=png\&optimize=medium)

A good way to get started is to copy `index`, `nav` and `footer` from the sample content to familiarize yourself with the content structure. `nav` and `footer` are not changed frequently in a project and have a special structure, most of the files in a helix project look more similar to `index`.

A good way to copy those files and to familiarize yourself with the structure is to open the files and copy/paste the entire content into your corresponding file. You can also download the files via “Download All” or downloads of individual files, but be mindful to convert the downloaded `.docx` files back into native google docs, if you upload them to your folder in your google drive.

To complete hooking up your content the only thing left is to tell Helix, where to get the content for the site by changing the reference in `fstab.yaml` in your github repo to the folder you just shared.\
Just copy/paste the folder URL from your google drive to `fstab.yaml`.

Be aware that after you make that change, you will see `404 not found `errors as your content has not been previewed yet. Please refer to the next section to see how to start authoring and preview your content. If you copied over `index`, `nav` and `footer` all three of those are separate documents, with their own preview and publish cycles, so make sure you preview (and publish) all of them if needed.

![](./media_1e7b9c243af2a857d0a431b20f07aadf2f9bfe562.png?width=750\&format=png\&optimize=medium)

![](./media_19cdf2c1a7b5f93389828aa8de3660d85b7865a9f.png?width=750\&format=png\&optimize=medium)

Commit your changes, and you have completed the steps needed to hook up your own content source.

## Preview and Publish your content

[https://main--helix-website--adobe.hlx.page/media\_1d7b6d38cd4f0ad9b661887e3a24b44a72f7c945e.mp4](./media_1d7b6d38cd4f0ad9b661887e3a24b44a72f7c945e.mp4)

After completing your last step, your new content source is possibly not completely empty, but no content has been promoted to the `preview` or `live `stages, which means your website should serve blank 404s at this point.

To preview content any author has to install the helix chrome extension or bookmarklet. Find the [chrome extension here](https://chrome.google.com/webstore/detail/helix-sidekick-beta/ccfggkjabjahcjoljmgmklhpaccedipo).

![](./media_1b86a3e704dd233972cce318e83a6dda44a787c1f.png?width=750\&format=png\&optimize=medium)

After adding the extension to chrome, don’t forget to pin it.

![](./media_1d7c76f6d5d0e2a5df540a25b77a8aefabfcd2e11.png?width=750\&format=png\&optimize=medium)

To setup the chrome extension the easiest path is to go to your github repo, and click “Add Project”

![](./media_158e5a49d59d14ad8f8259665927f11ee18fcae09.png?width=750\&format=png\&optimize=medium)

As soon as the extension is installed you are now ready to preview and publish your content from your google drive. Open the `index` doc and activate the helix sidekick by clicking on your pinned extension and then click the `Preview` button which will trigger the preview operation and open a new tab with the preview rendition of the content.

![](./media_161153232e3285a7eae3c82b903746c36e49ef8cc.png?width=750\&format=png\&optimize=medium)

Once on the preview page, you can just press the `Publish` button which will trigger the publication of the content to the live environment and redirect you to the corresponding URL.

![](./media_19b6d313a098d6d8540a745e9ba4a82b1a2f1b801.png?width=750\&format=png\&optimize=medium)

That’s it, you just published your first page with Helix.

Let’s make some changes and republish.

![](./media_1f6d66a54054c71b66bc67421a131c30d7490114c.png?width=750\&format=png\&optimize=medium)

![](./media_1eba5dc6a44e0bb0b869153ad2b79b1904d5bdc07.png?width=750\&format=png\&optimize=medium)

To complete the content of your site go through the same process with the `nav` and `footer` documents. After these steps you should have a fully functional website with a header and a footer, with all the content being completely controlled out of your own gdrive.

![](./media_172de918ec54e4a5f2267f64f63218b1ef0bf066b.png?width=750\&format=png\&optimize=medium)

## Start Developing Styling and Functionality

[https://main--helix-website--adobe.hlx.page/media\_141a9484b704e5113383b6ee92e09dd0ac352944a.mp4](./media_141a9484b704e5113383b6ee92e09dd0ac352944a.mp4)

To get started with development, it is easiest to install the helix-cli and clone your repo locally through via…

    npm install -g @adobe/helix-cli
    git clone https://github.com/<owner>/<repo>

…from there change into your project folder via and start your local dev env via

    cd <repo>
    hlx up

which will open up `http://localhost:3000/ `and you are ready to make changes.\
A good place to start is the blocks folder which is where most of the styling and code will live for you helix project. Simply make a change in a `.css` or `.js `and you should see the changes in your browser immediately.

Once you are are ready to push your changes, simply git add, commit and push and your code is on your preview (`https://<branch>--<repo>--<owner>.hlx.page/`) and production (`https://<branch>--<repo>--<owner>.hlx.live/`) site.

**That’s it, you made it! Congrats, your first Helix site is up and running.**
