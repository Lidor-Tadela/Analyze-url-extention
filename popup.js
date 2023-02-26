function analyzeUrl() {
  chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
    let currentUrl = tabs[0].url;
    console.log('Analyzing URL:', currentUrl);
    var matches = currentUrl.match(/\d+/);
    if (matches) {
      var number = parseInt(matches[0]);
      var newNumber = number + 1;
      var newUrl = currentUrl.replace(/\d+/, newNumber.toString());
      console.log('Modified URL:', newUrl);
      chrome.tabs.update({url: newUrl});
    };
});
};

console.log('starting....');
chrome.browserAction.onClicked.addListener(analyzeUrl);
console.log('end....');