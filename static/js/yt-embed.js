function embedYoutubeVideo(element, videoId) {
    const iframe = document.createElement('iframe');
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
    iframe.title = "YouTube video player";
    iframe.frameBorder = "0";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

    // replace the element's content with the iframe
    element.innerHTML = '';
    element.appendChild(iframe);
}