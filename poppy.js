function analyzeUrl() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    let currentUrl = tabs[0].url;
    console.log('Analyzing URL:', currentUrl);
    var numberList = currentUrl.match(/\d+/g);
    if (numberList && numberList.length > 0) {
      var lastNumber = numberList[numberList.length - 1];
      var newNumber = parseInt(lastNumber) + 1;
      var newUrl = currentUrl.replace(lastNumber, newNumber.toString());
      console.log('Modified URL:', newUrl);
      chrome.tabs.update({ url: newUrl });
    }
  });
}

console.log('starting....');
chrome.browserAction.onClicked.addListener(analyzeUrl);
console.log('end....');
