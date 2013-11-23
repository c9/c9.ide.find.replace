/*global describe it before after  =*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "text!plugins/c9.ide.layout.classic/skins.xml"], function (architect, chai, skin) {
    var expect = chai.expect;
    var bar;
    
    expect.setupArchitectTest([
        {
            packagePath : "plugins/c9.core/c9",
            workspaceId : "ubuntu/ip-10-35-77-180",
            startdate   : new Date(),
            debug       : true,
            hosted      : true,
            local       : false,
            davPrefix   : "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
        {
            packagePath : "plugins/c9.core/settings",
            settings    : "<settings><user><general animateui='true' /></user></settings>"
        },
        {
            packagePath  : "plugins/c9.ide.ui/ui",
            staticPrefix : "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        {
            packagePath : "plugins/c9.ide.ace/ace",
            staticPrefix : "plugins/c9.ide.layout.classic"
        },
        {
            packagePath : "plugins/c9.ide.find.replace/findreplace",
            staticPrefix : "plugins/c9.ide.find.replace"
        },
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.ui/tooltip",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.fs/fs",
        
        // Mock plugins
        {
            consumes : ["apf", "ui", "Plugin"],
            provides : [
                "commands", "menus", "watcher", 
                "save", "preferences", "clipboard",
                "dialog.alert", "auth.bootstrap"
            ],
            setup    : expect.html.mocked
        },
        {
            consumes : ["ui"],
            provides : ["layout"],
            setup    : function(options, imports, register){
                register(null, {
                    layout : (function(){
                        // Load the skin
                        imports.ui.insertSkin({
                            "data"       : skin,
                            "media-path" : "plugins/c9.ide.layout.classic/images/",
                            "icon-path"  : "plugins/c9.ide.layout.classic/icons/"
                        }, {addElement: function(){}});
                        
                        return {
                            initMenus: function() {},
                            findParent : function(){
                                if (!bar) {
                                    bar = apf.document.documentElement.appendChild(
                                        new imports.ui.vsplitbox());
                                    bar.$ext.style.position = "fixed";
                                    bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                                    bar.$ext.style.left = "20px";
                                    bar.$ext.style.right = "20px";
                                    bar.$ext.style.bottom = "20px";
                                    bar.$ext.style.height = "33%";
                                }
                                
                                return bar;
                            }
                        };
                    })()
                });
            }
        },
        {
            consumes : ["tabManager", "ace", "findreplace", "ui", "commands"],
            provides : [],
            setup    : main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs        = imports.tabManager;
        var ace         = imports.ace;
        var ui          = imports.ui;
        var findreplace = imports.findreplace;
        var commands    = imports.commands;
        
        var Range = require("ace/range").Range;
        
        
        function getTabHtml(tab){
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext
        }
        
        expect.html.setConstructor(function(tab){
            if (typeof tab == "object")
                return getTabHtml(tab);
        });
        
        describe('ace', function() {
            this.timeout(10000);
            
            before(function(done){
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
                tabs.getPanes()[0].focus();
                
                document.body.style.marginBottom = "33%";
                done();
            });
            
            describe("open", function(){
                var ace, tab;
                it('should open a pane with just an editor', function(done) {
                    tabs.open({
                        path: "/nofile.md",
                        value: "",
                        document: {
                            meta: {
                                newfile: true
                            }
                        }
                    }, function(err, page_){
                        expect(tabs.getTabs()).length(1);
                        tab = tabs.getTabs()[0];
                        ace = tab.editor.ace;
                        done();
                    });
                });
                it('should open findbar and select text', function(done) {
                    var str = [];
                    for (var i = 0; i < 100; i++) {
                        str.push( "a " + i + " b " + (i%10));
                    }
                    
                    tab.editor.focus();
                    ace.setValue(str.join("\n"));
                    
                    ace.selection.setRange(new Range(0, 0, 0, 1));
                    commands.exec("find");
                    
                    var txtFind = findreplace.getElement("txtFind");
                    expect(txtFind.getValue()).equal("a");
                    
                    tab.editor.focus();
                    ace.selection.setRange(new Range(0, 4, 0, 7));
                    
                    commands.exec("find");
                    expect(txtFind.getValue()).equal("b 0");
                    
                    ace.once("changeSelection", function() {                        
                        expect(ace.selection.getRange().end.row).equal(10);
                        done();
                    });
                    setTimeout(function() {
                        findreplace.findNext();                        
                    }, 100);
                });
                it('should find again', function() {
                    commands.exec("findnext");
                    expect(ace.selection.getRange().end.row).equal(20);
                   
                    
                    ace.selection.setRange(new Range(0, 0, 0, 7));
                    
                    commands.exec("findnext");
                    expect(ace.selection.getRange().start.column).equal(0);
                });
                it('should remember replace history', function() {
                    var codebox = findreplace.getElement("txtReplace").ace;
                    codebox.setValue("foo");
                    
                    commands.exec("replacenext");
                    codebox.setValue("bar");
                    commands.exec("replacenext");
                    
                    var kb = codebox.keyBinding;
                    var prev = kb.$handlers[1].commands.Up;
                    var next = kb.$handlers[1].commands.Down;
                    
                    codebox.execCommand(prev);
                    expect(codebox.getValue()).equal("foo");
                    codebox.execCommand(prev);
                    expect(codebox.getValue()).equal("foo");
                    
                    codebox.execCommand(next);
                    expect(codebox.getValue()).equal("bar");
                    
                    codebox.execCommand(next);
                    expect(codebox.getValue()).equal("");
                    
                    codebox.setValue("baz");
                    codebox.execCommand(next);
                    expect(codebox.getValue()).equal("");
                    codebox.execCommand(prev);
                    expect(codebox.getValue()).equal("baz");
                    codebox.execCommand(prev);
                    expect(codebox.getValue()).equal("bar");           
                });
                it('should close findbar', function() {
                    commands.exec("find");
                    window.app.services.findreplace.getElement("winSearchReplace").visible;
                });
            });
            describe("unload", function(){
                it('should open a pane with just an editor', function(done) {
                    if (!onload.remain)
                        findreplace.unload();
                    done();
                });
            });
            
            if (!onload.remain){
               after(function(done){
                   tabs.unload();
                   
                   document.body.style.marginBottom = "";
                   done();
               });
            }
        });
        
        onload && onload();
    }
});