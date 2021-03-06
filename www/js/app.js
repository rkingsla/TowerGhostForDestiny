window.isChrome = (typeof chrome !== "undefined");
window.isMobile = (/ios|iphone|ipod|ipad|android|iemobile/i.test(navigator.userAgent));

var dialog = (function(options){
	var self = this;
	
	this.modal;
	
	this.title = function(title){
		self.modal = new BootstrapDialog(options);
        self.modal.setTitle(title);
		return self;
	}
	
	this.content = function(content){
		self.modal.setMessage(content);
		return self;
	}
	
	this.buttons = function(buttons){
		self.modal.setClosable(true).enableButtons(true).setData("buttons", buttons);
		return self;
	}
	
	this.show = function(cb){
		self.modal.open();
		return self;
	}
});

var activeElement;
var moveItemPositionHandler = function(element, item){
	return function(){
		if (app.loadoutMode() == true){
			if (app.activeLoadout().ids().indexOf( item._id )>-1)
				app.activeLoadout().ids.remove(item._id);
			else {
				if ( _.where( app.activeLoadout().items(), { bucketType: item.bucketType }).length < 9){
					app.activeLoadout().ids.push(item._id);
				}
				else {
					BootstrapDialog.alert("You cannot create a loadout with more than 9 items in the " + item.bucketType + " slots");
				}
			}
		}
		else {
			var $movePopup = $( "#move-popup" );
			if (item.bucketType == "Post Master"){
				return BootstrapDialog.alert("Post Master items cannot be transferred with the API.");
			}
			if (element	== activeElement){
				$movePopup.hide();
				activeElement = null;
			}	
			else {
				activeElement = element;
				if (window.isMobile){
					$movePopup.show();
				}
				else {
					$movePopup.removeClass("navbar navbar-default navbar-fixed-bottom").addClass("desktop").show().position({
						my: "left bottom",
						at: "left top",
						collision: "none fit",
						of: element
					});
				}
			}
		}	
	}
}

ko.bindingHandlers.moveItem = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		Hammer(element)
			.on("tap", moveItemPositionHandler(element, viewModel))
			.on("doubletap", function() {
				$ZamTooltips.lastElement = element;
				$ZamTooltips.show("destinydb","items",viewModel.id, element);
			});
    }
};

var filterItemByType = function(type, isEquipped){
	return function(weapon){
		if (weapon.bucketType == type && weapon.isEquipped() == isEquipped)
			return weapon;
	}
}

var Profile = function(model){
	var self = this;
	_.each(model, function(value, key){
		self[key] = value;
	});
	
	this.icon = ko.observable(self.icon);	
	this.background = ko.observable(self.background);
	this.weapons = ko.observableArray([]);
	this.armor = ko.observableArray([]);
	this.items = ko.observableArray([]);
	this.uniqueName = self.level + " " + self.race + " " + self.gender + " " + self.classType;
	this.get = function(list, type){
		if (type)
			return self[list]().filter(filterItemByType(type, false));
		else
			return self[list]();
	}
	this.itemEquipped = function(list, type){
		return ko.utils.arrayFirst(self[list](), filterItemByType(type, true));
	}
}

var Item = function(model, profile, list){
	var self = this;
	_.each(model, function(value, key){
		self[key] = value;
	});
	this.list = list;
	this.character = profile;
	this.href = "https://destinydb.com/items/" + self.id;
	this.isEquipped = ko.observable(self.isEquipped);
	this.setActiveItem = function(){
		app.activeItem(self);
	}
	this.primaryStat = self.primaryStat || "";
	this.hasPerkSearch = function(search){
		var foundPerk = false;
		if (self.perks){
			var vSearch = search.toLowerCase();
			self.perks.forEach(function(perk){
				if (perk.name.toLowerCase().indexOf(vSearch) > -1 || perk.description.toLowerCase().indexOf(vSearch) > -1)
					foundPerk = true;
			});
		}
		return foundPerk;
	}
	this.hashProgress = function(state){
		if (typeof self.progression !== "undefined"){
			/* Missing XP */
			if (state == 1 && self.progression == false){
				return true;
			}
			/* Full XP  but not maxed out */
			else if (state == 2 && self.progression == true && self.isGridComplete == false){
				return true
			}
			/* Maxed weapons (Gold Borders only) */
			else if (state == 3 && self.progression == true && self.isGridComplete == true){
				return true;
			}
			else {
				return false;
			}
		}
		else {
			return false;
		}
	}
	this.isVisible = ko.computed(function(){
		var $parent = app;
		var searchFilter = $parent.searchKeyword() == '' || self.hasPerkSearch($parent.searchKeyword()) || 
			($parent.searchKeyword() !== "" && self.description.toLowerCase().indexOf($parent.searchKeyword().toLowerCase()) >-1);
		var dmgFilter = $parent.dmgFilter().length ==0 || $parent.dmgFilter().indexOf(self.damageTypeName) > -1;
		var setFilter = $parent.setFilter().length == 0 || $parent.setFilter().indexOf(self.id) > -1 || $parent.setFilterFix().indexOf(self.id) > -1;
		var tierFilter = $parent.tierFilter() == 0 || $parent.tierFilter() == self.tierType;
		var progressFilter = $parent.progressFilter() == 0 || self.hashProgress($parent.progressFilter());
		var typeFilter = $parent.typeFilter() == 0 || $parent.typeFilter() == self.type;
		var uniqueFilter = $parent.showUniques() == false || ($parent.showUniques() == true && self.isUnique);
		/*console.log( "searchFilter: " + searchFilter);
		console.log( "dmgFilter: " + dmgFilter);
		console.log( "setFilter: " + setFilter);
		console.log( "tierFilter: " + tierFilter);
		console.log( "progressFilter: " + progressFilter);
		console.log( "typeFilter: " + typeFilter);
		console.log("keyword is: " + $parent.searchKeyword());
		console.log("keyword is empty " + ($parent.searchKeyword() == ''));
		console.log("keyword has perk " + self.hasPerkSearch($parent.searchKeyword()));
		console.log("perks are " + JSON.stringify(self.perks));
		console.log("description is " + self.description);
		console.log("keyword has description " + ($parent.searchKeyword() !== "" && self.description.toLowerCase().indexOf($parent.searchKeyword().toLowerCase()) >-1));*/
		return (searchFilter) && (dmgFilter) && (setFilter) && (tierFilter) && (progressFilter) && (typeFilter) && (uniqueFilter);
	});
	/* helper function that unequips the current item in favor of anything else */
	this.unequip = function(callback){
		//console.log('trying to unequip too!');
		if (self.isEquipped() == true){
			//console.log("and its actually equipped");
			var otherEquipped = false, itemIndex = -1;
			var otherItems = _.where( self.character[self.list](), { bucketType: self.bucketType });
			var tryNextItem = function(){			
				var item = otherItems[++itemIndex];
				//console.log(item.description);
				/* still haven't found a match */
				if (otherEquipped == false){
					if (item != self){
						//console.log("trying to equip " + item.description);
						item.equip(self.characterId, function(isEquipped){
							//console.log("result was " + isEquipped);
							if (isEquipped == true){ otherEquipped = true; callback(); }
							else { tryNextItem(); /*console.log("tryNextItem")*/ }
						});				
					}
					else {
						tryNextItem()
						//console.log("tryNextItem")
					}
				}
			}
			tryNextItem();		
			//console.log("tryNextItem")
		}
		else {
			//console.log("but not equipped");
			callback();
		}
	}
	this.equip = function(targetCharacterId, callback){
		//console.log("equip called");
		var sourceCharacterId = self.characterId;
		if (targetCharacterId == sourceCharacterId){
			//console.log("item is already in the character");
			app.bungie.equip(targetCharacterId, self._id, function(e, result){
				if (result.Message == "Ok"){
					self.isEquipped(true);
					self.character[self.list]().forEach(function(item){
						if (item != self && item.bucketType == self.bucketType){
							item.isEquipped(false);							
						}
					});
					if (self.list == "items" && self.bucketType == "Emblem"){
						self.character.icon(app.makeBackgroundUrl(self.icon, true));
						self.character.background(self.backgroundPath);
					}
					if (callback) callback(true);
				}
				else {
					if (callback) callback(false);
					else BootstrapDialog.alert(result.Message);
				}
			});
		}
		else {
			//console.log("item is NOT already in the character");
			self.store(targetCharacterId, function(newProfile){
				//console.log("item is now in the target destination");
				self.character = newProfile;
				self.characterId = newProfile.id;
				self.equip(targetCharacterId, callback);
			});
		}
	}
	
	this.transfer = function(sourceCharacterId, targetCharacterId, amount, cb){		
		//console.log("Item.transfer");
		//console.log(arguments);
		//setTimeout(function(){
			var isVault = targetCharacterId == "Vault";
			app.bungie.transfer(isVault ? sourceCharacterId : targetCharacterId, self._id, self.id, amount, isVault, function(e, result){
				//console.log("app.bungie.transfer after");
				//console.log(arguments);
				if (result.Message == "Ok"){
					var x,y;
					_.each(app.characters(), function(character){
						if (character.id == sourceCharacterId){
							//console.log("removing reference of myself ( " + self.description + " ) in " + character.classType + " from the list of " + self.list);
							x = character;
						}
						else if (character.id == targetCharacterId){
							//console.log("adding a reference of myself ( " + self.description + " ) to this guy " + character.classType);
							y = character;
						}
					});
					if (self.bucketType == "Materials" || self.bucketType == "Consumables"){
						//console.log("need to split reference of self and push it into x and y");
						var remainder = self.primaryStat - amount;
						/* at this point we can either add the item to the inventory or merge it with existing items there */
						var existingItem = _.findWhere( y[self.list](), { description: self.description });
						if (existingItem){
							y[self.list].remove(existingItem);
							existingItem.primaryStat = existingItem.primaryStat + amount;
							y[self.list].push(existingItem);
						}
						else {
							self.characterId = targetCharacterId
							self.character = y;
							self.primaryStat = amount;
							y[self.list].push(self);
						}
						/* the source item gets removed from the array, change the stack size, and add it back to the array if theres items left behind */
						x[self.list].remove(self);
						if (remainder > 0){
							self.characterId = sourceCharacterId
							self.character = x;
							self.primaryStat = remainder;
							x[self.list].push(self);
						}
					}
					else {
						self.characterId = targetCharacterId
						self.character = y;
						y[self.list].push(self);
						x[self.list].remove(self);
					}
					if (cb) cb(y,x);
				}
				else {
					BootstrapDialog.alert(result.Message);
				}
			});		
		//}, 1000);
	}
	
	this.store = function(targetCharacterId, callback){
		//console.log("item.store");
		//console.log(arguments);
		var sourceCharacterId = self.characterId, transferAmount = 1;
		var done = function(){			
			if (targetCharacterId == "Vault"){
				//console.log("from character to vault");
				self.unequip(function(){
					//console.log("calling transfer from character to vault");
					self.transfer(sourceCharacterId, "Vault", transferAmount, callback);
				});
			}
			else if (sourceCharacterId !== "Vault"){
				//console.log("from character to vault to character");
				self.unequip(function(){
					//console.log("unquipped item");
					self.transfer(sourceCharacterId, "Vault", transferAmount, function(){
						//console.log("xfered item to vault");
						self.transfer("Vault", targetCharacterId, transferAmount, callback);
					});
				});
			}
			else {
				//console.log("from vault to character");
				self.transfer("Vault", targetCharacterId, transferAmount, callback);
			}		
		}
		if (self.bucketType == "Materials" || self.bucketType == "Consumables"){
			if (self.primaryStat == 1){
				done();
			}
			else {
				(new dialog({
		            message: "<div>Transfer Amount: <input type='text' id='materialsAmount' value='" + self.primaryStat + "'></div>",
		            buttons: [
						{
		                	label: 'Transfer',
							cssClass: 'btn-primary',
							action: function(dialogItself){
								transferAmount = parseInt($("input#materialsAmount").val());
								if (!isNaN(transferAmount)){ done(); dialogItself.close(); }
								else { BootstrapDialog.alert("Invalid amount entered: " + transferAmount); }
							}
		            	}, 
						{
			                label: 'Close',		                
			                action: function(dialogItself){
			                    dialogItself.close();
			                }
		            	}
		            ]
		        })).title("Transfer Materials").show();			
			}
		}
		else {
			done();
		}
	}
}

var DestinyGender = {
	"0": "Male",
	"1": "Female",
	"2": "Unknown"
};
var DestinyClass = {
    "0": "Titan",
    "1": "Hunter",
    "2": "Warlock",
    "3": "Unknown"
};
var DestinyDamageTypes = {
    "0": "None",
    "1": "Kinetic",
    "2": "Arc",
    "3": "Solar",
    "4": "Void",
    "5": "Raid"
};
var DestinyBucketTypes = {
	"1498876634": "Primary",
	"2465295065": "Special",
	"953998645": "Heavy",
	"3448274439": "Helmet",
	"3551918588": "Gauntlet",
	"14239492": "Chest",
	"20886954": "Boots",
	"2973005342": "Shader",
	"4274335291": "Emblem",
	"2025709351": "Sparrow",
	"284967655": "Ship",
	"3865314626": "Materials",
	"1469714392": "Consumables",
	"1585787867": "Class Items",
	"12345": "Post Master"
}
var DestinyArmorPieces = [ "Helmet", "Gauntlet", "Chest", "Boots" ];
var DestinyDamageTypeColors = {
	"None": "#BBB",
	"Kinetic": "#BBB",
	"Arc": "#85C5EC",
	"Solar": "#C48A01",
	"Void": "#B184C5"
}
var _collectionsFix = {
	"exoticWeapons": [],
	"vaultWeapons": [],
	"crotaWeapons": [],
	"ironWeapons": [1488311144,1244530683,1451703869,3244859508,996787434,3800763760,337037804,1487387187], /* 300 ATK: Fusion,Sniper,Shotgun,LMG,Rocket,Scout,Hand Cannon,Pulse */
	"exoticArmor": [],
	"vaultArmor": [],
	"crotaArmor": [],
	"ironArmor": []
}

/*
targetItem: item,
swapItem: swapItem,
description: item.description + "'s swap item is " + swapItem.description
*/
var swapTemplate = _.template('<ul class="list-group">' +	
	'<% swapArray.forEach(function(pair){ %>' +
		'<li class="list-group-item">' +
			'<div class="row">' +
				'<div class="col-lg-6">' +
					'<%= pair.description %>' +
				'</div>' +
				'<div class="col-lg-3">' +
					'<a class="item" href="<%= pair.targetItem.href %>" id="<%= pair.targetItem._id %>">' + 
						'<img class="itemImage" src="<%= pair.targetItem.icon %>">' +
					'</a>' +
				'</div>' +
				'<div class="col-lg-3">' +
					'<a class="item" href="<%= pair.swapItem && pair.swapItem.href %>" id="<%= pair.swapItem && pair.swapItem._id %>">' + 
						'<img class="itemImage" src="<%= pair.swapItem && pair.swapItem.icon %>">' +
					'</a>' +
				'</div>' +
			'</div>' +
		'</li>' +
	'<% }) %>' +
'</ul>');

var perksTemplate = _.template('<div class="destt-talent">' +
	'<% perks.forEach(function(perk){ %>' +
		'<div class="destt-talent-wrapper">' +
			'<div class="destt-talent-icon">' +
				'<img src="<%= perk.iconPath %>" width="36">' +
			'</div>' +
			'<div class="destt-talent-description">' +
				'<%= perk.description %>' +
			'</div>' +
		'</div>' +
	'<% }) %>' +
'</div>');

var User = function(model){
	var self = this;
	_.each(model, function(value, key){
		self[key] = value;
	});	
	//try loading the Playstation account first
	this.activeSystem = ko.observable(self.psnId ? "PSN" : "XBL" );
}

var app = new (function() {
	var self = this;

	var defaults = {
		searchKeyword: "",
		doRefresh: isMobile ? false : true,
		refreshSeconds: 300,
		tierFilter: 0,
		typeFilter: 0,
		dmgFilter: [],
		progressFilter: 0,
		setFilter: [],
		shareView: false,
		shareUrl: "",
		showMissing: false,
		showUniques: false,
		tooltipsEnabled: isMobile ? false : true,
		listenerEnabled: true //ive had to turn it off for iPhone and Android it's buggy
	};
	var getValue = function(key){
		var saved = window.localStorage.getItem(key);
		if (_.isEmpty(saved)){
			return defaults[key];
		}
		else {
			return saved == "true"
		}
	}
	this.retryCount = ko.observable(0);
	this.loadingUser = ko.observable(false);
	this.loadoutMode = ko.observable(false);
	this.activeLoadout = ko.observable(new Loadout());
	this.loadouts = ko.observableArray();
	this.searchKeyword = ko.observable(defaults.searchKeyword);
	var _doRefresh = ko.observable(getValue("doRefresh"));
	var _tooltipsEnabled = ko.observable(getValue("tooltipsEnabled"));
	this.doRefresh = ko.computed({
		read: function(){
			return _doRefresh();
		},
		write: function(newValue){
			window.localStorage.setItem("autoRefresh", newValue);
			_doRefresh(newValue);
		}
	});
	this.tooltipsEnabled = ko.computed({
		read: function(){
			return _tooltipsEnabled();
		},
		write: function(newValue){
			$ZamTooltips.isEnabled = newValue;
			window.localStorage.setItem("tooltipsEnabled", newValue);
			_tooltipsEnabled(newValue);
		}
	});

	this.listenerEnabled = ko.observable(defaults.listenerEnabled);
	this.refreshSeconds = ko.observable(defaults.refreshSeconds);
	this.tierFilter = ko.observable(defaults.tierFilter);
	this.typeFilter = ko.observable(defaults.typeFilter);
	this.dmgFilter =  ko.observableArray(defaults.dmgFilter);
	this.progressFilter =  ko.observable(defaults.progressFilter);
	this.setFilter = ko.observableArray(defaults.setFilter);
	this.setFilterFix = ko.observableArray(defaults.setFilter);
	this.shareView =  ko.observable(defaults.shareView);
	this.shareUrl  = ko.observable(defaults.shareUrl);
	this.showMissing =  ko.observable(defaults.showMissing);
	this.showUniques =  ko.observable(defaults.showUniques);
	
	this.activeItem = ko.observable();
	this.activeUser = ko.observable(new User());

	this.weaponTypes = ko.observableArray();
	this.characters = ko.observableArray();
	this.orderedCharacters = ko.computed(function(){
		return self.characters().sort(function(a,b){
			return a.order - b.order;
		});
	});
	
	this.createLoadout = function(){
		self.loadoutMode(true);		
		self.activeLoadout(new Loadout());
	}
	this.cancelLoadout = function(){
		self.loadoutMode(false);
		self.activeLoadout(new Loadout());
	}	
	
	this.showHelp = function(){
		(new dialog).title("Help").content($("#help").html()).show();
	}
		
	this.showAbout = function(){
		(new dialog).title("About").content($("#about").html()).show();
	}
	
	this.clearFilters = function(model, element){
		self.searchKeyword(defaults.searchKeyword);
		self.doRefresh(defaults.doRefresh);
		self.refreshSeconds(defaults.refreshSeconds);
		self.tierFilter(defaults.tierFilter);
		self.typeFilter(defaults.typeFilter);
		self.dmgFilter.removeAll();
		self.progressFilter(defaults.progressFilter);
		self.setFilter.removeAll()
		self.setFilterFix.removeAll()
		self.shareView(defaults.shareView);
		self.shareUrl (defaults.shareUrl);
		self.showMissing(defaults.showMissing);
		self.showUniques(defaults.showUniques);
		$(element.target).removeClass("active");
		return false;
	}
	this.renderCallback = function(context, content, element, callback){
		if (element) lastElement = element
		var instanceId = $(lastElement).attr("instanceId"), activeItem, $content = $("<div>" + content + "</div>");
		self.characters().forEach(function(character){
		  ['weapons','armor'].forEach(function(list){
	          var item = _.findWhere( character[list](), { '_id': instanceId });
			  if (item) activeItem = item;			  	
	      });
	   	});
		if (activeItem){
			/* Weapons */
			if ($content.find("[class*='destt-damage-color-']").length == 0 && activeItem.damageType > 1){
				var burnIcon = $("<div></div>").addClass("destt-primary-damage-" + activeItem.damageType);
				$content.find(".destt-primary").addClass("destt-damage-color-" + activeItem.damageType).prepend(burnIcon);
			}
			if (activeItem.perks && $content.find(".destt-talent").length == 0){
				$content.find(".destt-info").prepend(perksTemplate({ perks: activeItem.perks }));
			}
			/* Armor */
			var stats = $content.find(".destt-stat");
			if (activeItem.stats && stats.length > 0){
				stats.html(
					stats.find(".stat-bar").map(function(index, stat){ 
						var $stat = $("<div>"+stat.outerHTML+"</div>"),
							label = $stat.find(".stat-bar-label"),
							labelText = $.trim(label.text());
						if (labelText in activeItem.stats){							 
							label.text(labelText + ": " + activeItem.stats[labelText]);
							$stat.find(".stat-bar-static-value").text(" Min/Max: " + $stat.find(".stat-bar-static-value").text());
						}
						return $stat.html();
					}).get().join("")
				);
			}
			$content.find(".destt-primary-min").html( activeItem.primaryStat );
		}
		else {
			//remove the "Emblem" title from the image issue #31
			if ($content.find(".fhtt-emblem").length > 0){
				$content.find("span").remove();
			}
		}
		var width = $(window).width();
		//this fixes issue #35 makes destinydb tooltips fit on a mobile screen
		if (width < 340){
			$content.find(".fhtt.des").css("width", width + "px");
		}
		callback($content.html());
	}
	this.toggleListener = function(){
		self.listenerEnabled(!self.listenerEnabled());
	}
	this.toggleRefresh = function(){
		self.doRefresh(!self.doRefresh());
	}	
	this.toggleDestinyTooltips = function(){
		self.tooltipsEnabled(!self.tooltipsEnabled());		
	}
	this.toggleShareView = function(){
		self.shareView(!self.shareView());
	}
	this.toggleShowUniques = function(){
		self.showUniques(!self.showUniques());
	}
	this.toggleShowMissing = function(){
		self.showMissing(!self.showMissing());
	}
	this.setSetFilter = function(model, event){
		var collection = $(event.target).parent().attr("value");
		self.setFilter(collection == "All" ? [] : _collections[collection]);
		self.setFilterFix(collection == "All" ? [] : _collectionsFix[collection]);
	}
	this.missingSets = ko.computed(function(){
		var missingIds = [];
		self.setFilter().concat(self.setFilterFix()).forEach(function(item){
		   var itemFound = false;
		   self.characters().forEach(function(character){
			  ['weapons','armor'].forEach(function(list){
		          if (_.pluck( character[list](), 'id') .indexOf(item) > -1) itemFound = true;
		      });
		   });
		   if (!itemFound) missingIds.push(item);
		});
		return missingIds;
	})
	
	this.activeView = ko.observable(0);
	this.setView = function(model, event){
		self.activeView($(event.target).parent().attr("value"));
	}	
	this.setDmgFilter = function(model, event){
		var dmgType = $(event.target).parents('li:first').attr("value");
		self.dmgFilter.indexOf(dmgType) == -1 ? self.dmgFilter.push(dmgType) : self.dmgFilter.remove(dmgType);
	}
	this.setTierFilter = function(model, event){
		self.tierFilter($(event.target).parent().attr("value"));
	}
	this.setTypeFilter = function(model, event){
		self.typeFilter($(event.target).parent().attr("value"));
	}
	this.setProgressFilter = function(model, event){
		self.progressFilter($(event.target).parent().attr("value"));
	}
						
	var processItem = function(profile){	
		return function(item){
			if (!(item.itemHash in window._itemDefs)){
				console.log("found an item without a definition! " + JSON.stringify(item));
				console.log(item.itemHash);
				return;
			}
			var info = window._itemDefs[item.itemHash];
			var itemObject = { 
				id: item.itemHash,
				_id: item.itemInstanceId,
				characterId: profile.id,
				damageType: item.damageType,
				damageTypeName: DestinyDamageTypes[item.damageType],
				description: info.itemName, 
				bucketType: DestinyBucketTypes[info.bucketTypeHash],
				type: info.itemSubType, //12 (Sniper)
				typeName: info.itemTypeName, //Sniper Rifle
				tierType: info.tierType, //6 (Exotic) 5 (Legendary)
				icon: self.bungie.getUrl() + info.icon,
				isEquipped: item.isEquipped,
				isGridComplete: item.isGridComplete
			};
			if (item.primaryStat){
				itemObject.primaryStat = item.primaryStat.value;
			}	
			if (item.progression){
				itemObject.progression = (item.progression.progressToNextLevel == 0 && item.progression.currentProgress > 0);
			}
			if (item.location == 4)
					itemObject.bucketType = "Post Master";
					
			if (info.itemType == 3 && item.location !== 4){
				itemObject.perks = item.perks.map(function(perk){
					if (perk.perkHash in window._perkDefs){
						var p = window._perkDefs[perk.perkHash];
						return {
							iconPath: app.bungie.getUrl() + perk.iconPath,
							name: p.displayName,
							description: p.displayDescription
						}
					}
					else {
						return perk;
					}					
				});
				if (info.talentGridHash in window._talentGridDefs){					
					itemObject.isUnique = info.tierType != 6 && (_.pluck(_.where(window._talentGridDefs[info.talentGridHash].nodes,{column:5}),'isRandom').indexOf(true) > -1);
				}
				else {
					itemObject.isUnique = false;
				}
				profile.weapons.push( new Item(itemObject,profile,'weapons') );
			}
			else if (info.itemType == 2 && item.location !== 4 && DestinyArmorPieces.indexOf(itemObject.bucketType) > -1){				
				itemObject.stats = {};
				_.each(item.stats, function(stat){
					if (stat.statHash in window._statDefs){
						var p = window._statDefs[stat.statHash];
						itemObject.stats[p.statName] = stat.value;
					}
				});
				profile.armor.push( new Item(itemObject,profile,'armor') );
			}
			else if (info.bucketTypeHash in DestinyBucketTypes){
				if (itemObject.typeName && itemObject.typeName == "Emblem"){
					itemObject.backgroundPath = self.makeBackgroundUrl(info.secondaryIcon);
				}
				if (itemObject.bucketType == "Materials" || itemObject.bucketType == "Consumables"){
					itemObject.primaryStat = item.stackSize;
				}
				profile.items.push( new Item(itemObject,profile,'items') );
			}
		}
	}
	
	this.addWeaponTypes = function(weapons){
		weapons.forEach(function(item){
			if (_.where(self.weaponTypes(), { type: item.type}).length == 0)
				self.weaponTypes.push({ name: item.typeName, type: item.type });
		});
	}
	
	this.makeBackgroundUrl = function(path, excludeDomain){
		return "url(" + (excludeDomain ? "" : self.bungie.getUrl()) + path + ")";
	}
	
	this.hasBothAccounts = function(){
		return !_.isEmpty(self.activeUser().psnId) && !_.isEmpty(self.activeUser().gamerTag);
	}
	
	this.useXboxAccount = function(){
		self.activeUser().activeSystem("XBL");
		self.characters.removeAll();
		self.loadingUser(true);
		self.search();
	}
	
	this.usePlaystationAccount = function(){
		self.activeUser().activeSystem("PSN");
		self.characters.removeAll();
		self.loadingUser(true);
		self.search();
	}	
	
	this.search = function(){
		var total = 0, count = 0;
		/* TODO: implement a better loading bar by using the counts and this: #loadingBar */
		function done(){
			count++;
			if (count == total){
				//console.log("finished loading");
				self.shareUrl(new report().de());
				self.loadingUser(false);
			}
		}	
		self.bungie.search(self.activeUser().activeSystem(),function(e){
			if (e.error){
				/* if the first account fails retry the next one*/
				if (self.hasBothAccounts()){
					self.activeUser().activeSystem( self.activeUser().activeSystem() == "PSN" ? "XBL" : "PSN" );
					self.search();
				}
				else {
					BootstrapDialog.alert("Account has no data");
				}				
				self.loadingUser(false);
				return
			}
			var avatars = e.data.characters;
			total = avatars.length + 1;
			self.bungie.vault(function(results){
				var buckets = results.data.buckets;
				var profile = new Profile({ 
					race: "", 
					order: 0, 
					gender: "Tower",
					classType: "Vault", 
					id: "Vault", 
					level: "",
					imgIcon: "assets/vault_icon.jpg",
					icon: self.makeBackgroundUrl("assets/vault_icon.jpg",true), 
					background: self.makeBackgroundUrl("assets/vault_emblem.jpg",true) 
				});
				
				buckets.forEach(function(bucket){
					bucket.items.forEach(processItem(profile));
				});
				self.addWeaponTypes(profile.weapons());
				self.characters.push(profile);
				done()
			});
			avatars.forEach(function(character, index){
				self.bungie.inventory(character.characterBase.characterId, function(response) {
					var profile = new Profile({
						order: index+1,
						gender: DestinyGender[character.characterBase.genderType],
						classType: DestinyClass[character.characterBase.classType],
						id: character.characterBase.characterId,
						imgIcon: self.bungie.getUrl() + character.emblemPath,
						icon: self.makeBackgroundUrl(character.emblemPath),
						background: self.makeBackgroundUrl(character.backgroundPath),
						level: character.characterLevel,
						race: window._raceDefs[character.characterBase.raceHash].raceName
					});
					var items = [];						
					
					Object.keys(response.data.buckets).forEach(function(bucket){
						response.data.buckets[bucket].forEach(function(obj){
							obj.items.forEach(function(item){
								items.push(item);
							});
						});
					});
					
					items.forEach(processItem(profile));
					self.addWeaponTypes(profile.weapons());
					self.characters.push(profile);
					done();
				});
			});
		});		
	}
	
	this.loadData = function(ref, loop){
		if (self.loadingUser() == false){
			self.loadingUser(true);
			self.bungie = new bungie(self.bungie_cookies); 
			self.characters.removeAll();
			self.bungie.user(function(user){
				self.activeUser(new User(user));
				if (user.error){
					self.loadingUser(false);
					return
				}
				if (ref && loop){
					ref.close();
					clearInterval(loop);
				}
				self.search();			
			});		
		}
	}
	
	this.refreshHandler = function(){
		clearInterval(self.refreshInterval);
		if (self.loadoutMode() == true){
			if ($(".navbar-toggle").is(":visible")) $(".navbar-toggle").click();
			$("body").css("padding-bottom","260px");
		}
		else {
			$("body").css("padding-bottom","0");
		}
		if (self.doRefresh() == 1 && self.loadoutMode() == false){
			self.refreshInterval = setInterval(self.loadData, self.refreshSeconds() * 1000);
		}
	}
	
	this.donate = function(){
		window.open("http://bit.ly/1Jmb4wQ","_blank");
	}
	
	this.openBungieWindow = function(type){
		return function(){
			var loop, newCookie;
			//overwrite the same reference to avoid crashing?
			window.ref = window.open('https://www.bungie.net/en/User/SignIn/' + type, '_blank', 'location=yes');			
			if (isMobile){
				ref.addEventListener('loadstop', function(event) {
					if (self.listenerEnabled() == true){
						clearInterval(loop);
						loop = setInterval(function() {
							ref.executeScript({
								code: 'document.cookie'
							}, function(result) {
								console.log("found result in loadstop " + result);
								if ((result || "").toString().indexOf("bungled") > -1){
									self.bungie_cookies = result;
									window.localStorage.setItem("bungie_cookies", result);
									self.loadData(ref, loop);
								}
							});
						}, 500);				
					}
				});
				ref.addEventListener('loadstart', function(event) {
					clearInterval(loop);
				});
				ref.addEventListener('exit', function() {
					if (self.characters().length == 0){
						clearInterval(loop);
						if (_.isEmpty(self.bungie_cookies)){
							loop = setInterval(function() {
								ref.executeScript({
									code: 'document.cookie'
								}, function(result) {
									console.log("found result in exit " + result);
									if ((result || "").toString().indexOf("bungled") > -1){
										self.bungie_cookies = result;
										window.localStorage.setItem("bungie_cookies", result);
										self.loadData();		
										clearInterval(loop);
									}
								});
							}, 500);
						}
						else {
							self.loadData();
						}
					}
				});
			}
			else {
				clearInterval(loop);
				loop = setInterval(function(){
					if (window.ref.closed){
						clearInterval(loop);
						self.loadData();
					}
				}, 100);
			}
		}
	}
	
	this.init = function(){
		self.doRefresh.subscribe(self.refreshHandler);
		self.refreshSeconds.subscribe(self.refreshHandler);
		self.loadoutMode.subscribe(self.refreshHandler);		
		self.bungie_cookies = window.localStorage.getItem("bungie_cookies");
		var isEmptyCookie = (self.bungie_cookies || "").indexOf("bungled") == -1;
		var _loadouts = window.localStorage.getItem("loadouts");
		(function() {
		  if (navigator.userAgent.match(/IEMobile\/10\.0/)) {
		    var msViewportStyle = document.createElement("style");
		    msViewportStyle.appendChild(
		      document.createTextNode("@-ms-viewport{width:auto!important}")
		    );
		    document.getElementsByTagName("head")[0].appendChild(msViewportStyle);
		  }
		})();
		if (!_.isEmpty(_loadouts)){
			self.loadouts(
				_.map(JSON.parse(_loadouts), function(loadout){
					return new Loadout(loadout);
				})
			);
		}		
		
		if (isMobile && isEmptyCookie){
			console.log("code 99");
			self.activeUser(new User({"code": 99, "error": "Please sign-in to continue."}));
		}	
		else {
			console.log("loadData");
			setTimeout(self.loadData, isChrome ? 1 : 5000);		
		}
		$("form").bind("submit", false);
		$("html").click(function(e){
			if ($("#move-popup").is(":visible") && e.target.className !== "itemImage") {
				$("#move-popup").hide();
			}
		});
		ko.applyBindings(self);
	}
}); 

window.zam_tooltips = { addIcons: false, colorLinks: false, renameLinks: false, renderCallback: app.renderCallback, isEnabled: app.tooltipsEnabled() };

if (isMobile){
	document.addEventListener('deviceready', app.init, false);
	$(document).on('deviceready', function () {
	    if (window.device && parseFloat(window.device.version) >= 7.0) {
		$('body').addClass('iOS7');
	    }
	});
} else {
	$(document).ready(app.init);
}

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://ssl.google-analytics.com/analytics.js','ga');

ga('create', 'UA-61575166-1', 'auto');
ga('send', 'pageview');