/* shop.js v1.2 */
// Initialize Firebase
var config = {
	apiKey: "AIzaSyDKcdh3A079cP8_xmznnQGY35rLSOVuheY",
	authDomain: "boiling-fire-4404.firebaseapp.com",
	databaseURL: "https://boiling-fire-4404.firebaseio.com",
	projectId: "boiling-fire-4404",
	storageBucket: "boiling-fire-4404.appspot.com",
	messagingSenderId: "711113832511"
};
firebase.initializeApp(config);

var db_root = firebase.database().ref();
var db_auth = firebase.auth();

var db = db_root;

var model = {
	allItems: {},
	alphabetical: [],
	shopOrder: [],
	homeOrder: [],
	login: {}
};

model.isTempLogin = function () {
	return ((((model || {}).login || {}).authData || {}).password || {}).isTemporaryPassword;
}
model.getUserName = function() {
	return ((((model || {}).login || {}).authData || {}).password || {}).email;
}

var getUID = function() {
	if (model.login.authData) return model.login.authData.uid;
};


// Set the new shopOrder locally after UI changed.
var setShopOrder = function(item, newOrder) {
	setOrdering('shopOrder', item, item.shop, newOrder);
	updateDBOrderingAfterMove();
};
// Set the new homeOrder locally after UI changed.
var setHomeOrder = function(item, newOrder) {
	setOrdering('homeOrder', item, item.home, newOrder);
	updateDBOrderingAfterMove();
};

// Set local ordering after UI change.
var setOrdering = function (arrayKey, item, originalOrder, newOrder) {
	var tempArray = model[arrayKey].slice(0, originalOrder);
	tempArray = tempArray.concat(model[arrayKey].slice(originalOrder + 1));

	var newArray = tempArray.slice(0, newOrder);
	newArray.push(item);
	newArray = newArray.concat(tempArray.slice(newOrder));

	model[arrayKey] = newArray;
};

// Save an existing item back to DB (after modification)
var setExistingItem = function (item, key) {
	var save_item = $.extend({}, item);
	if (!key) key = save_item.key;
	delete save_item.key;

	db.child(key).set(save_item);
}

var getCurrentMode = function() {
	var list = $('#list');
	return list.attr('data-mode') || 'homeOrder';
};

var insertItem = function (home, shop, name) {
	return db.push({home: home, shop: shop, name: name});
}

var displayAllItems = function (mode) {
	var header = $('#fixedHeader');
	var list = $('#list');
	var index = $('#index');
	if (!mode) mode = list.attr('data-mode');

	var content = (mode === 'print' ? 
					displayAllPrintingItems(mode) :
					displayAllOrderedItems(mode));

	list.html(content);
	list.attr('data-mode', mode);
	index.attr('data-mode', mode);
	header.attr('data-mode', mode);

	writeLocalStorageMode();

	setFontSize();
}

var displayAllPrintingItems = function (mode) {
	var array = model.shopOrder.filter(function(x) { return x.amount > 0; });

	var total = array.length;
	var half = Math.ceil(total / 2);
	var left = $('<div />').addClass('leftColumn');
	left.html(array.slice(0, half).map(displayPrintItem));
	var right = $('<div />').addClass('rightColumn');
	right.html(array.slice(half).map(displayPrintItem));
	return [left, right];
	//return array.map(function(i) { return displayPrintItem(i); }); 
};

var displayAllOrderedItems = function (mode) {
	var array = model[mode] || [];
	return array.map(function(i) { return displayItem(i); }); 
};

var displayEditItem = function (item) {
	var div = $('<div />').addClass('editable');

	div.append($('<input type="text" />')
						.addClass('description')
						.attr('value', item.name));
	div.append($('<span />').addClass('finish-edit fa fa-check'));
	div.append($('<span />').addClass('cancel-edit fa fa-times'));

	return div;
};

var displaySpanItem = function (item) {
	var div = $('<div />').addClass('editable');

	var text = $('<span />').addClass('description').text(item.name);
	if (!item.amount) text.addClass('zero');
	div.append(text);
	if (item.amount > 1)
		div.append($('<span />').text(' x ' + item.amount));
	div.append($('<span />').addClass('edit fa fa-pencil'));

	return div;
};

var changeToEdit = function(container) {
	var key = container.attr('id');
	var item = findItem(key);
	var desc = container.find('.editable');
	desc.html(displayEditItem(item).html());
}


var setFontSize = function(newSize) {
	var mode = getCurrentMode();
	if (newSize) {
		writeLocalStoragePrintFontSize(newSize);
	} else {
		readLocalStorage();
		newSize = model.printFontSize;
	}
	if (mode === 'print') {
		$('#list').css('font-size', newSize.toString() + 'pt');
	} else {
		var cssObject = $('#list').prop('style'); 
		cssObject.removeProperty('font-size');
		$('#list').css('font-size', 'auto');
	}
}

/********************************************************************************************************
 MOVE MODE
 ********************************************************************************************************/

var cancelMoveMode = function() {
	$('#moveItemContainer').find('.item').remove();
	unsetListFromMoveMode();
	displayAllItems();
};

// take all the items in the moveMode box, and put them 
// before the item specified by container.
var placeItemsFromMoveMode = function (container) {
	var placeKey = container.attr('id');
	var itemsInMove = $('#moveItemContainer').find('.item');
	var keys = itemsInMove.map(function(i, x) { return x.id; });
	keys = $.makeArray(keys);

	var mode = getCurrentMode();
	var mainArray = (mode === 'homeOrder' ? model.homeOrder :
					 mode === 'shopOrder' ? model.shopOrder : null);

	if (!mainArray) return; // bail out!

	// Make it look like it happened.
	itemsInMove.remove();
	container.before(itemsInMove);

	var newArray = [];
	for (var i = 0; i < mainArray.length; i++) {
		var currentItem = mainArray[i];
		if (keys.indexOf(currentItem.key) === -1) {
			if (currentItem.key === placeKey) {
				for (var j = 0; j < keys.length; j++) {
					var moveItem = findItem(keys[j]);
					newArray.push(moveItem);
				}
			}
			newArray.push(currentItem);
		}
	}
	if (placeKey === 'extraItem') {
		for (var j = 0; j < keys.length; j++) {
			var moveItem = findItem(keys[j]);
			newArray.push(moveItem);
		}
	}

	model[mode] = newArray;
	updateDBOrderingAfterMove();
}

var setListToMoveMode = function() {
	var list = $('#list');
	if (list.hasClass('showMoveMarker')) return;

	list.addClass('showMoveMarker');
	$('#moveItemContainer').removeClass('empty')
	var extraItem = $('<div />').addClass('item').attr('id', 'extraItem');
	extraItem.append($('<span />').html('&nbsp;'));
	list.append(extraItem);

	list.on('click.insertItem', '.item', function(e) {
		placeItemsFromMoveMode($(this));		
		unsetListFromMoveMode();
	});
};

var unsetListFromMoveMode = function () {
	var list = $('#list');
	$('#moveItemContainer').addClass('empty')
	list.removeClass('showMoveMarker');
	list.find('#extraItem').remove();

	list.off('click.insertItem');
};

var scrollToKey = function (key) {
	var container = $('#' + key);
	scrollToView(container);
};

var scrollToView = function(element){
    var offset = element.offset().top;
    if(!element.is(":visible")) {
        element.css({"visiblity":"hidden"}).show();
        var offset = element.offset().top;
        element.css({"visiblity":"", "display":""});
    }

    var visible_area_start = $(window).scrollTop();
    var visible_area_end = visible_area_start + window.innerHeight;

    if(offset < visible_area_start || offset > visible_area_end){
         // Not in view so scroll to it
         $('html,body').animate({scrollTop: offset - window.innerHeight/3}, 200);
         return false;
    }
    return true;
}



/***********************************************
 EDITING TEXT
 ***********************************************/

var resetToNormalTextCancelling = function (container) {
	var key = container.attr('id');
	var item = findItem(key);
	var desc = container.find('.editable');
	desc.html(displaySpanItem(item).html());
};

var resetToNormalText = function (container) {
	var key = container.attr('id');
	var item = findItem(key);
	var input = container.find('input.description');
	var newText = input.val();
	if (newText != item.name) {
		item.name = newText;
		db.child(key).set(item);
		resortAlphabetical();
		relocateAfterDBNameChange(item);
	}
	var desc = container.find('.editable');
	desc.html(displaySpanItem(item).html());
};

var resetAllToNormalText = function() {
	var existing = $('input.description');
	var parents = existing.map(function (i, x) { return $(x).parent(); });
	parents.each(function(i,x) {
		resetToNormalText(x);
	});
}

var displayPrintItem = function (item) {
	if (item.amount) {
		var div = $('<div />').addClass('item').attr('id', item.key);
		div.append($('<span />').text(item.name));
		if (item.amount > 1)
			div.append($('<span />').text(' x ' + item.amount));
		return div;
	}
}

var displayItem = function(item) {
	var div = $('<div />').addClass('item').attr('id', item.key);
	div.append($('<div />').addClass('amount decrease fa fa-minus'));
	div.append($('<div />').addClass('amount increase fa fa-plus'));
	div.append(displaySpanItem(item));

	div.append($('<span />').addClass('move fa fa-arrows-v'));
	div.append($('<span />').addClass('delete fa fa-trash-o'));
	return div;
};

var clearAllAmounts = function() {
	forEach(model.allItems, function (item) { item.amount = 0; });
	initialiseItems(model.allItems);
	db.set(model.allItems); 
};

var modifyAmount = function (key, difference) {
	// Update local model and send a +/-1 to the server.
	var item = findItem(key);
	var amount = (item.amount || 0) + difference;
	if (amount < 0) amount = 0;
	item.amount = amount;

	$('#' + key).html(displayItem(item).html());

	var itemRef = db.child(key).once('value', function (snapshot) {
		var serverItem = snapshot.val();
		var originalAmount = (serverItem.amount || 0);
		var newAmount = originalAmount + difference;
		if (newAmount < 0) newAmount = 0;
		if (newAmount > 999) newAmount = 999;

		if (originalAmount !== newAmount) {
			serverItem.amount = newAmount;
			db.child(key).set(serverItem);
		}
	});


};

var isUserInLocalStorage = function(username) {
	return username === localStorage.getItem('username');
}

var readLocalStorage = function() {
	model.username = localStorage.getItem('username');
	model.password = localStorage.getItem('password');

	model.startMode = localStorage.getItem('startMode') || getCurrentMode();

	model.printFontSize = localStorage.getItem('printFontSize') || 9;
}
var writeLocalStoragePrintFontSize = function(fontSize) {
	localStorage.printFontSize = fontSize;
	model.printFontSize = fontSize;
}
var writeLocalStorageLogin = function (username, password) {
	localStorage.setItem('username', username);
	localStorage.setItem('password', password);
	model.username = username;
	model.password = password;
}
var writeLocalStorageMode = function () {
	var startMode = getCurrentMode();
	localStorage.setItem('startMode', startMode);
	model.startMode = startMode;
}


var updateDBOrderingAfterMove = function() {
	// Check that the ordering is compact and sequential.
	var to_update = {};
	for (var i = 0; i < model.shopOrder.length; i++) {
		var item = model.shopOrder[i];
		if (item.shop !== i) {
			item.shop = i;
			to_update[item.key] = item;
		}
	}
	for (var i = 0; i < model.homeOrder.length; i++) {
		var item = model.homeOrder[i];
		if (item.home !== i) {
			item.home = i;
			to_update[item.key] = item;
		}
	}

	forEach(to_update, function(x) { setExistingItem(x); });
}

var resortAlphabetical = function () {
	model.alphabetical = model.alphabetical
							  .map(function(x) { 
							  	return x; 
							  })
							  .sort(
							  	sortBy('name', true, function(a) { 
							  		if (a) return a.toUpperCase();
							  		return "";
							  		}));
};

var resortAllModelArrays = function () {
	resortAlphabetical();

	var items = model.alphabetical;
	model.shopOrder = items
						.map(function(x) { return x; })
						.sort(sortBy('shop', true, parseInt));

	model.homeOrder = items
						.map(function(x) { return x; })
						.sort(sortBy('home', true, parseInt));
}

var initialiseItems = function (allItems) {
	var items = [];
	forEach(allItems, function(item, p) {
		item.key = p;
		item.amount = item.amount || 0;
		items.push(item);
	});

	model.allItems = allItems;

	model.alphabetical = items;
	resortAllModelArrays();
};

var forEach = function (object, fn) {
	for (var p in object)
		if (object.hasOwnProperty(p))
			fn(object[p], p);
};

var findItem = function (key) {
	return model.allItems[key];
};

var sortBy = function (field, reverse, primer) {
    // Sorting objects: 
    // Usage: myArray.sort(QC.sortBy('name', true, function(x) { return x.toUpperCase() }));
    //        myArray.sort(QC.sortBy('id', true, parseInt));
    //        myArray.sort(QC.sortBy(function(x) { return x.deadline ? x.deadline : x.completed; }, true, Date.parse));
    var isFN = isFunction(field);
    var key = primer ?
       function (x) { return primer(isFN ? field(x) : x[field]) } :
       function (x) { return isFN ? field(x) : x[field] };

    reverse = [-1, 1][+!!reverse];

    return function (a, b) {
        return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    }
}

var isFunction = function (functionToCheck) {
	var getType = {};
	return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

var relocateAfterDBNameChange = function (item) {
	if (getCurrentMode() !== 'alphabetical') return;

	var myItem = $('#' + item.key);
	if (!isInList(myItem)) return;

	var previousItem = findPreviousAlphabeticalInList(item);

	myItem.remove();
	if (!previousItem) 
		$('#list').prepend(myItem);
	else
		previousItem.after(myItem);
}

var relocateAfterDBChange = function (item, mode) {
	if (getCurrentMode() !== mode) return;

	var myItem = $('#' + item.key);
	if (!isInList(myItem)) return;

	var itemKey = (mode == 'homeOrder' ? 'home' : 'shop');
	var previousItem = findPreviousNumericItemInList(item, model[mode], itemKey);

	myItem.remove();
	if (!previousItem) 
		$('#list').prepend(myItem);
	else
		previousItem.after(myItem);
}

var findPreviousNumericItemInList = function (item, array, itemKey) {
	if (item.shop === 0) return undefined;
	var myKey = item.key;
	for (var i = item[itemKey] - 1; i >= 0; i--) {
		var matches = array
						   .filter(function (x) { return x[itemKey] === i && x.key !== myKey; })
						   .map(function(x){ return $('#' + x.key); } )
						   .filter(function(x) { return isInList($(x)); });
		if (matches.length > 0) return matches[0];
	}
	return undefined;
}

var findPreviousAlphabeticalInList = function(item) {
	var previousItem = undefined;
	var array = model.alphabetical;
	for (var i = 0; i < array.length; i++) {
		var obj = array[i];
		if (obj.key === item.key) return previousItem;
		var container = $('#' + obj.key)
		if (isInList(container)) previousItem = container;
	}
	return previousItem;
}

var isInList = function (container) {
	return container.parent().attr('id') === 'list';
}

var initialiseFromSnapshot = function (snapshot) {
	initialiseItems(snapshot.val());
	updateDBOrderingAfterMove();
	displayAllItems(model.startMode);
	resetIndex();
	resizeIndex();
	db.on('child_changed', function (s) {
		var key = s.key;
		var item = findItem(key);
		var modified = s.val();
		if (item.name !== modified.name ||
			item.shop !== modified.shop ||
			item.home !== modified.home ||
			item.amount !== modified.amount) {

			var requiresShopMove = (item.shop !== modified.shop);
			var requiresHomeMove = (item.home !== modified.home);
			var requiresNameMove = (item.name !== modified.name);


			if (requiresShopMove) 
				console.log('Shop move from ' + item.shop + ' to ' + modified.shop);


			itemEditExistingModel(item, modified);
			var newItem = displayItem(modified);
			$('#' + key).html(newItem.html());

			resortAllModelArrays();

			if (requiresShopMove)
				relocateAfterDBChange(item, 'shopOrder');

			if (requiresHomeMove)
				relocateAfterDBChange(item, 'homeOrder');

			if (requiresNameMove)
				relocateAfterDBNameChange(item);

			pulseRow(key);
		}
	});
	db.on('child_added', function(s) {
		var key = s.key;
		if (!findItem(key)) {
			itemAddToModel(s.val(), key);
			displayAllItems();
			pulseRow(key);
		}
	});
	db.on('child_removed', function(s) {
		var key = s.key;
		if (findItem(key)) {
			removeItemFromModel(key);
			var container = $('#' + key);
			var isInMove = (!isInList(container));
			container.remove();
			if (!$('#moveItemContainer .item').length) cancelMoveMode();
		}
	});
}

var removeItemFromModel = function(key) {
	delete model.allItems[key];
	model.alphabetical = model.alphabetical.filter(function(x) { return x.key !== key; });
	resortAllModelArrays();
	updateDBOrderingAfterMove();
};

var itemEditExistingModel = function(item, newItem) {
	item.name = newItem.name;
	item.amount = newItem.amount;
	item.shop = newItem.shop;
	item.home = newItem.home;
}

var itemAddToModel = function (item, key) {
	// Add the item to our internal model.
	item.key = key;
	model.allItems[key] = item;
	model.alphabetical.push(item);
	resortAlphabetical();
	model.shopOrder.push(item);
	model.homeOrder.push(item);
	setOrdering('shopOrder', item, model.shopOrder.length - 1, item.shop);
	setOrdering('homeOrder', item, model.homeOrder.length - 1, item.home);
	updateDBOrderingAfterMove();
};

var pulseRow = function (key, colour) {
	pulse($('#' + key), colour);
}

var pulse = function (row, colour) {
    var chosenColour = colour || '#3B8BE5'; //'#5BB646';
    var bg = row.css('background-color');
    if (!bg) {
        row.css({ 'background-color': bg });
    } 
    bg = "inherit";
    row.animate({ 'background-color': chosenColour }, 300)
       .animate({ 'background-color': bg }, 300);
};

var toUnique = function(a,b,c){//array,placeholder,placeholder
	b=a.length;
	while(c=--b)while(c--)a[b]!==a[c]||a.splice(c,1);
	return a; // not needed ;)
}

/* Index on alphabetic list */

var resetIndex = function () {
	var index = $('#index');
	var array = model.alphabetical
					.filter(function(x) { return !!x.name; })
					.map(function(x) { return x.name[0].toUpperCase(); });
	toUnique(array);
	var indexArray = array.map(function(x) { 
		return $('<span />').attr('data-index', x).text(x);
	});
	index.html(indexArray);
};

var resizeIndex = function() {
	var index = $('#index');
	if (index.attr('data-mode') !== 'alphabetical') 
		return;

	var windowHeight = window.innerHeight;
	var spans = index.find('span');
	if (spans.length > 1) {
		for (var i = 1; i < 40; i++) {
			spans.css('padding-bottom', i.toString() + 'px');
			var height = index.height();
			if (height + 100 > windowHeight) {
				spans.css('padding-bottom', (i - 1).toString() + 'px')
				return;
			}
		}
	}
};

window.onresize = function(event) {
    resizeIndex();
};

/* Login section */

var loginToShopping = function (username, password) {
	if (username && password) {
		var promise = db_auth.signInWithEmailAndPassword(username, password).then(
			function(authData, a, b, c) { 
				model.login = {}; 
				model.login.err = null; 
				model.login.authData = authData.user;

				showMainUI();

				db = db_root.child('users').child(getUID()).child('list');
				db.once('value', function (s) {
					initialiseFromSnapshot(s);
				});
				
			}
		).catch(function (err) {
			model.login = {}; 
			model.login.err = err; 
			model.login.authData = null;
			
			showLogin(err);
		});
	}
};

var hideAllUI = function() {
	$('#interface').hide();
	$('#list').hide();
	$('#change-pass').hide();
	$('#change-pass-err').hide();
	$('#login').hide();
	$('#login-err').hide();
	$('#change-pass').hide();
}

var showChangePassword = function(err) {
	hideAllUI();

	$('#change-pass').show();
	if (err) {
		$('#change-pass-err-text').text(err.message);
		$('#change-pass-err').show().delay(2000).fadeOut('slow');
	}
}

var showLogin = function(err) {
	hideAllUI();

	$('#login').show();

	if (err) {
		$('#login-err-text').text(err.message);
		$('#login-err').show().delay(2000).fadeOut('slow');
	}
}
var showMainUI = function() {
	hideAllUI();

	$('#interface').show();
	$('#list').show();
}

/* EVENTS */

$('#changepassword').on('click', function(e) {
	e.preventDefault();
	showChangePassword();
})

$('#btnChangePass').on('click', function(e) {
	e.preventDefault();

	var username = model.getUserName();
	if (username) {
		var rememberMe = isUserInLocalStorage(model.username);

		var oldpassword = $('#change-pass-oldpassword').val();
		var newpassword = $('#change-pass-newpassword').val();

		db_root.changePassword({
		  email       : username,
		  oldPassword : oldpassword,
		  newPassword : newpassword
		}, function(error) {
		  if (error === null) {
		    console.log("Password changed successfully");
    		if (rememberMe) {
				writeLocalStorageLogin(username, newpassword);
			}
			showMainUI();

		  } else {
		    console.log("Error changing password:", error);
		    showChangePassword(error);
		  }
		});

	}
});

$('#btnLogin').on('click', function(e) {
	e.preventDefault();
	var rememberMe = $('#login-rememberme').prop('checked');
	var username = $('#login-username').val();
	var password = $('#login-password').val();
	if (rememberMe) {
		writeLocalStorageLogin(username, password);
	}
	loginToShopping(username, password);
});

$('#list').on('click', '.delete', function(e) {
	e.preventDefault();
	var container = $(this).closest('.item');
	var key = container.attr('id');
	var item = findItem(key);
	if (confirm('Are you sure you wish to delete ' + item.name + '?')) {
		db.child(key).remove();
	}
});

$('#list').on('click', '.amount', function(e) {
	e.preventDefault();
	var container = $(this).closest('.item');
	var key = container.attr('id');
	if ($(this).hasClass('increase'))
		modifyAmount(key, +1);
	else
		modifyAmount(key, -1);
});

$('#list').on('click', '.finish-edit', function(e) {
	e.preventDefault();
	resetToNormalText($(this).closest('.item'));
});
$('#list').on('click', '.cancel-edit', function(e) {
	e.preventDefault();
	resetToNormalTextCancelling($(this).closest('.item'));
});
$('#list').on('click', '.edit', function(e) {
	e.preventDefault();
	resetAllToNormalText();
	changeToEdit($(this).closest('.item'));
});

$('#increaseFont').on('click', function(e) {
	e.preventDefault();
	setFontSize(+model.printFontSize + 1);
});
$('#decreaseFont').on('click', function(e) {
	e.preventDefault();
	setFontSize(+model.printFontSize - 1);
});

$('#index').on('click', 'span', function (e) {
	e.preventDefault();
	var dataIndex = $(this).attr('data-index');
	var matches = model.alphabetical
					.filter(function(x) { 
						return x.name[0].toUpperCase() === dataIndex
					});
	if (matches.length) {
		var key = matches[0].key;
		scrollToKey(key);
		pulseRow(key);
	}
});

$('#moveCancel').on('click', function(e) {
	e.preventDefault();
	cancelMoveMode();
})

$('#list').on('click', '.move', function (e) {
	e.stopPropagation();
	var container = $(this).closest('.item');
	container.remove();
	$('#moveItemContainer').append(container);

	setListToMoveMode();
});

$('a.ordering').on('click', function(e) { 
	e.preventDefault();
	cancelMoveMode();
	displayAllItems(this.id);
});
$('a.printing').on('click', function(e) { 
	e.preventDefault();
	cancelMoveMode();
	displayAllItems(this.id);
});
$('a.clearing').on('click', function(e) { 
	e.preventDefault();
	if (confirm('This clears all the amounts back to zero. Is that ok?')) {
		cancelMoveMode();
		clearAllAmounts();
		displayAllItems();
	}
});

$('input#addNew').on('keypress', function (e) {
	if (e.keyCode === 13) {
		var mode = getCurrentMode();
		var shopOrder = 0;
		var homeOrder = 0;
		var containerAtTop = $(document.elementFromPoint(0, 100)).closest('.item');
		var name = $(this).val().trim();
		if (name) {
			if (containerAtTop.length) {
				var item = findItem($(containerAtTop).attr('id'));
				shopOrder = item.shop + 1;
				homeOrder = item.home + 1;
			}
			insertItem(homeOrder, shopOrder, name);
		}
	}
});

/* First run: Check to see if we can log in with current credentials... */
readLocalStorage();

if (model.username && model.password) {
	loginToShopping(model.username, model.password);
} else {
	showLogin();
}
