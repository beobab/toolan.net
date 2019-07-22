var markdownToTargetDiv = function() {
	var sourceMarkdown = document.getElementById('sourceMarkdown');
	var text = sourceMarkdown.innerHTML;
    var target = document.getElementById('targetDiv');
    var html = marked(text);
    
    target.innerHTML = html;
	sourceMarkdown.style.display = 'none';
};
