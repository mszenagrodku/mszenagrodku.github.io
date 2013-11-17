var mng;
(function (mng) {

    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function (fn, scope) {
            var i, len;
            for (i = 0, len = this.length; i < len; ++i) {
                if (i in this) {
                    fn.call(scope, this[i], i, this);
                }
            }
        };
    }
    
    if (!Array.prototype.map) {
        Array.prototype.map = function (fn, scope) {
            var i, len, res = [ ];
            for (i = 0, len = this.length; i < len; ++i) {
                if (i in this) {
                    res.push(fn.call(scope, this[i], i, this));
                }
            }
            return res;
        };
    }    

    var unpack = function (data) {
        var arr = [ ], key, element;
        for (key in data) {
            element = data[key];
            element.ref = key;
            arr.push(element);
        }
        
        return arr;
    }

    var getNextSundays = function (count) {
        var today = new Date(),
            daysTillSunday = 7 - today.getDay(),
            result = [ today ],
            i,
            nextSunday;
            
        if (today.getDay() !== 0) {
            today.setDate(today.getDate() + daysTillSunday);
        }
        
        for (i = 1; i < count; ++i) {
            nextSunday = new Date();
            nextSunday.setDate(result[i - 1].getDate() + 7);
            result.push(nextSunday);
        }
        
        return result;
    };
    
    var getShortDate = function (date) {
        return String(
            date.getFullYear() * 10000 +
            (date.getMonth() + 1) * 100 +
            date.getDate());
    };
    
    var months = [
        'stycznia', 'luty', 'marca', 'kwietnia', 'maja', 'czerwca',
        'lipca', 'sierpni', 'wrzesnia', 'pazdziernika', 'listopada', 'grudnia'
    ];
    
    var formatDate = function (date) {
        var day = String(date.getDate());
        return day + ' ' + months[date.getMonth()];
    };
    
    var AppVm = function (dates) {
        this._fb = new Firebase('https://mszenagrodku.firebaseio.com');
        this._dates = [ ];
        
        this.days = dates.map(function (d) {
            var shortDate = getShortDate(d);
            this._dates.push(shortDate);
            return { 
                date: shortDate,
                text: formatDate(d)
            };
        }, this);
        this.ministries = ko.observableArray([ ]);

        this.errorGeneral = ko.observable(false);
        this.errorCredentials = ko.observable(false);
        
        this._selectedElement = null;
        
        this.user = ko.observable('');
        this.focusUser = ko.observable(false);
        this.userErrorIgnore = ko.observable(true);
        this.userError = ko.computed(function () {
            return !this.userErrorIgnore() && this.user() === '';
        }, this);
        this.password = ko.observable('');
        this.passwordErrorIgnore = ko.observable(true);
        this.passwordError = ko.computed(function () {
            return !this.passwordErrorIgnore() && this.password() === '';
        }, this);

        this.formVisible = ko.observable(false);
        this.gridVisible = ko.observable(true);
        
        this.isAdding = ko.observable(false);
        this.isRemoving = ko.observable(false);
        
        this.select = AppVm.prototype.select.bind(this);
        this.assign = AppVm.prototype.assign.bind(this);
        this.unassign = AppVm.prototype.unassign.bind(this);
        this.cancel = AppVm.prototype.cancel.bind(this);
    };
    
    AppVm.prototype._generalErrorHandler = function (error) {
        if (error) {
            console.log(error.toString());
        }
        this.errorGeneral(true);
    };
    
    AppVm.prototype._permissionDeniedHandler = function () {
        this.errorCredentials(true);
    };
    
    AppVm.prototype._isTaken = function () {
        return this.user() !== null;
    };
    
    AppVm.prototype._createMinistry = function (ministryData) {
        var ministry = {
            name: ministryData.name,
            text: ministryData.text,
            ref: ministryData.ref
        };
        ministry.assignments = this._dates.map(function (date) {
            var assignment = {
                name: ministryData.name,
                date: date,
                user: ko.observable(null)
            };
            assignment.taken = ko.computed(this._isTaken, assignment);
            return assignment;
        }, this);
        this.ministries.push(ministry);
    };
    
    AppVm.prototype._createUpdater = function (date, ministryName) {
        return function (snapshot) {
            var m, ministry, a, assignment, val = snapshot.val();
            for (m = 0; m < this.ministries().length; ++m) {
                ministry = this.ministries()[m];
                if (ministry.name !== ministryName) {
                    continue;
                }
                
                for (a = 0; a < ministry.assignments.length; ++a) {
                    assignment = ministry.assignments[a];
                    if (assignment.date === date) {
                        assignment.user(val === null || val.deleted ? null : val.user);
                        return;
                    }
                }
            }
        };
    };
    
    AppVm.prototype._setupDataEvents = function () {
        this._dates.forEach(function (date) {
            this.ministries().forEach(function (ministry) {
                var ref = 'days/' + date + '/' + ministry.name + '/assignment';
                this._fb.child(ref).on(
                    'value',
                    this._createUpdater(date, ministry.name),
                    this._generalErrorHandler,
                    this);
            }, this);
        }, this);
    };
    
    var ministriesData = [
        { name: "sacristian", text: "zakrystianin" },
        { name: "acolyte", text: "ministrant" },
        { name: "lesson", text: "pierwsze czytanie" },
        { name: "psalm", text: "psalm" },
        { name: "procession", text: "procesja z darami" },
        { name: "bread", text: "chleb" }
    ];    
    
    AppVm.prototype.loadData = function (ministriesData) {
        ministriesData.forEach(function (ministryData) {
            this._createMinistry(ministryData);
        }, this);
        this._setupDataEvents();
    };

    AppVm.prototype._showForm = function () {
        this.gridVisible(false);
        this.formVisible(true);
        this.focusUser(true);
    };
    
    AppVm.prototype._hideForm = function () {
        this._selectedElement = null;
        this.formVisible(false);
        this.gridVisible(true);
        this.userErrorIgnore(true);
        this.passwordErrorIgnore(true);
        this.errorCredentials(false);
    };

    AppVm.prototype.select = function (element) {
        var hasUser = element.user() !== null;
        this.isAdding(!hasUser);
        this.isRemoving(hasUser);
        this._selectedElement = element;
        this._showForm();
    };
    
    AppVm.prototype._createUser = function (user, password, onComplete) {
        var userRef = this._fb.child('users/' + user + '/exists');
        userRef.once(
            'value',
            function (snapshot) {
                var exists = snapshot.val();
                if (exists === true) {
                    onComplete();
                } else {
                    this._fb
                        .child('users/' + user)
                        .set({ exists: true, password: password }, function (error) {
                            if (error === null) {
                                onComplete();
                            } else {
                                this._generalErrorHandler(error);
                            }
                        }.bind(this));
                }
            },
            this._generalErrorHandler,
            this);    
    };
    
    AppVm.prototype._sendAssignment = function (data) {
        var el = this._selectedElement;
        var ref = 'days/' + el.date + '/' + el.name;
        this._fb.child(ref).set(data, function (error) {
            if (error === null) {
                this._hideForm();
            } else {
                this._permissionDeniedHandler(error);
            }
        }.bind(this));
    };    
    
    AppVm.prototype._updateAssignment = function (deleted) {
        this.userErrorIgnore(false);
        this.passwordErrorIgnore(false);

        if (this.userError() || this.passwordError()) {
            return;
        }

        var data = { 
            assignment: {
                user: this.user(),
                deleted: deleted
            },
            password: this.password()
        };
        
        this._createUser(data.assignment.user, data.password, this._sendAssignment.bind(this, data));
    };
    
    AppVm.prototype.assign = function () {
        this._updateAssignment(false);
    };
    
    AppVm.prototype.unassign = function () {
        this._updateAssignment(true);
    };    
    
    AppVm.prototype.cancel = function () {
        this._hideForm();
    };    
    
    var vm = new AppVm(getNextSundays(4));
   
    mng.bind = function () {
        ko.applyBindings(vm);
        vm.loadData(ministriesData);
    };
})(mng || (mng = { }));