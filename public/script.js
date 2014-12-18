var socket = io.connect();

function addEvent(content) {
	var doScroll = false;
	var scrollTop = $("#chatEntries")[0].scrollTop;
	var scrollHeight = $("#chatEntries")[0].scrollHeight - $("#chatEntries").height();
	if(scrollTop == scrollHeight)
		doScroll = true;
	$("#chatEntries").append('<div class="message"><p>' + content + '</p></div>');
	if(doScroll) {
		$("#chatEntries").scrollTop($("#chatEntries")[0].scrollHeight);
	}
}

function sentMessage() {
	if ($('#messageInput').val() != "") {
		socket.emit('message', $('#messageInput').val());
		$('#messageInput').val('');
	}
}

function set_username() {
	if ($("#usernameInput").val() != "") {
		socket.emit('set_username', $("#usernameInput").val());
		$('#chatControls').show();
		$('#login').hide();
	}
}

socket.on('message', function(data) {
	var content = data['username'] + ' : ' + data['message']
	addEvent(content);
});

socket.on('event', function(data) {
	var content = '* ' + data['message'];
	addEvent(content);
});

socket.on('set_scrambled', function(data) {
	$("#scrambledword").html(data.scrambledword);
});

socket.on('set_timeleft', function(data) {
	$("#timeleft").html(data.timeleft);
});

socket.on('set_highscore', function(data) {
	$("#highscore").html('');
	var l = data.highscore.length;
	for (var i = 0; i < l; i++) {
		var html = '';
		html += '<tr><td>' + data.highscore[i].Score + '</td>';
		html += '<td>' + data.highscore[i].Name + '</td></tr>';
		$("#highscore").append(html);
	}
});

$(function() {
	$("#chatControls").hide();
	$("#usernameSet").click(function() {set_username()});
	$("#usernameInput").keyup(function(event) {
		if(event.keyCode == 13){
			set_username();
		}
    });

	$("#submit").click(function() {sentMessage();});
	$("#messageInput").keyup(function(event) {
		if(event.keyCode == 13){
			sentMessage();
		}
    });
});
