/*
 * @Description: In User Settings Edit
 * @Author: your name
 * @Date: 2019-05-27 09:47:20
 * @LastEditTime: 2019-08-22 11:53:29
 * @LastEditors: Please set LastEditors
 */
Array.prototype.remove = function(val) { 
    var index = this.indexOf(val); 
    if (index > -1) { 
        this.splice(index, 1); 
    } 
};



/**
 * 数据驱动实用于为html元素赋值和html元素的属性赋值，但不实用于为html元素添加属性(但也提出了解决方案，如例3)
   {{ name }} 用于将name的值输出到页面
   {{- return a + b; }} 用于简单的表达式 ，将表达式的结果输出到页面
   属性id用于非循环的html页面
   属性listId用于循环的html列表
 params:{
        selector:'',
        listId:'',
        host:'',
        data:{},
        packet:{
            error:0,
            data:{}
        }
    }

    使用案例：1
    <div id data-uri="/api/goods/home"></div>
    <script>
        new DL({
            dev: 'on',                     //on表示为开发者模式，输了接口请求返回的数据
            id:'#myCarousel',              //被填充数据元素的id
            childId:'#myCarousel-img',     //被填充数据列表项的id,如果没有列表，则不需要
            data:{suppliersId:2},
            //host:'',
            //callback:function,
            befor:function(thisObj){
                console.log(thisObj.results);
                var length = thisObj.results.data.length;
                
                for(var j = 0; j < length; j ++){
                    $('#myCarousel-tag').children().first().clone(true).appendTo('#myCarousel-tag');
                }
                
                var currentItems = $('#myCarousel-tag').children();
                currentItems.first().addClass('active');
                currentItems.each(function(index,item){
                    console.log(index);
                    $(item).attr("data-slide-to",index).attr('id','myCarousel-tag-'+index);
                });
            },
            after:function(){
                $("#myCarousel-img").children().first().addClass('active');
            }
        });
    </script>

    使用案例：2
    
    <ul id="ksdfskdgjsdsdg-0">
        <li style="border:1px solid red;">
            <span>{{name}}</span>
            <span>{{sex}}</span>
        </li>
    </ul>
    <script>
        new DL({
                listId: '#ksdfskdgjsdsdg-0',
                packet:{
                    error:0,        //当大于0时，驱动会取消
                    data:[
                        {
                            name:"zhs",
                            sex:"WOMAN"
                        },
                        {
                            name:"lis",
                            sex:"WOMAN"
                        }
                    ]
                }
                
        });
        new DL({
            id: '#ksdfskdgjsdsdg',
            packet:{
                error:0,
                data:{
                    name:"zhs",
                    sex:"WOMAN"
                },
            }
                
        });
    </script>
        
    使用案例：3(选中默认的项，用data-selected属性值表示)
    <select id="select-t0" data-selected='ls'>
        <option  value="{{- return val; }}">{{- return name; }}</option>
    </select>
    <script>
        new DL({
            listId:'#select-t0',     //被填充数据列表项的id,如果没有列表，则不需要
            packet:{
                error: 0,
                data: [
                    {name:"张三",val:"zs"},
                    {name:"李四",val:"ls"},
                    {name:"王二",val:"we"},
                ]
            },
        });
    </script>
 *   
 */

//window.Hosts = ['http://192.168.1.115:8086'];

function ViewData(params){
	var that = this;
	params = params || {};
    this.dev = params.dev;
    //默认接口服务器
    this.host = params.host ? params.host : ((window.Hosts) ? Hosts[0] : "");
    //被操作的视图模块标识
    this.selector = params.id;
    //被操作的视图模块
    this.view = $(this.selector);
    //被操作的视图模块中的列表标识
    this.listTag = params.childId || params.listId;
    //限制加载的记录,limit:0,5, 加载第0条开始，共加载5条
    this.limit = params.limit || '0,-1';
    //请求时传送的参数
    this.data = params.data;
    //是否异步
    this.async = params.async || true;
    //接口地址
    this.uri = params.uri;
	this.timeout = params.timeout || 120000;
    //接口数据加载前的操作
    this.befor = params.befor;
    //接口数据加载后的操作
    this.after = params.after;
    //错误时回调
    this.error = params.error;
    //中间数据存储的容器
    this.tempData = null;
    //指定循环列表记录时，以第几条记录作为模板。0表示第一条，-1表示最后一条
    this.use = params.use || 0;
    //是否删除初始记录,0表示删除（默认），1表示不删除
    this.deleteInitList = params.deleteInitList || 0;
    //记录被渲染的次数
    this.applyTiems = 0;
    //手动赋予的数据{}|[{},{}...]
    this.results = params.packet || [];
    //当没有数据时的提示,html代码
    this.nullData = params.nullData || '<div class="text-center">还没有数据...</div>';
    //是否使用暂存的数据
    this.cached = params.cached || false;
    //是否清除暂存的逻辑代码（设置为true, 渲染时采用dome中新的代码）
    this.clearCode = params.clearCode || false;
    this.result = {};
    
	this.exit = function(){
		that.dev = 'exit;'
	}
	
    this.log = function(){
        console.log("==uri：：：",this.host + this.uri,"======data：：：",this.data, "======返回数据：：：",this.results);
    }

    /**
     * 设置tempDAta
     */
    this.setData = function(data){
        this.tempData = {data:data};
    }
    
    this.init = function(){
		var that = this;
        if(that.dev === 'exit') return;
        //请求并渲染数据
        //渲染数据
        if(params.packet){
            if(that.dev === 'on') that.log();
            if(typeof that.befor === "function") that.befor(that);
            that.loadData();
            if(typeof that.after === "function") that.after(that);
            that.setEffect();
        }else{
            if(!that.uri){
                if(that.listTag) that.uri = $(that.listTag).attr("data-uri");
                if(that.selector) that.uri = $(that.selector).attr("data-uri");
            }
            if(!that.uri) return;
            //y读取本地缓存数据，如果读取成功，则不发起请求
            var cacheData = that.cached ? getDLData(this.queryStr()) : false;
            if(cacheData){
                that.results = cacheData;
                that.run();
                return;
            }
			
			var reqData = {
				url:  that.host + that.uri,
				data: that.data,
				type: "POST",
				success: function(results){
					console.log("success::::",results)
					that.setRespons(results);
					if(!that.results) return;
					setDLData(that.queryStr(),that.results);
					that.run();
				},
				error: function(results){
					console.log("error::::",results);
					that.results = results;
					if(that.dev === 'on') that.log(that.results);
					if(typeof that.error === "function") that.error(that.results);
				}
			};
			if(typeof plus == 'undefined'){
				reqData.dataType = "text";
				reqData.async = that.async;
				$.ajax(reqData);
			}else{
				reqData.timeout = that.timeout;
				(new xhr5()).ajax(reqData);
			}
        }
    }
	
	/**
	 * @param {Object} results 设置响应的数据
	 */
	this.setRespons = function(results){
		var that = this;
		var json = '';
		var text = '';
		try{
			json = JSON.parse(results);
		}catch(e){
			try{
				eval((results));
			}catch(e){
				text = results;
			};
		}
		that.results = json || text || '';
	}

    //生成请求标识
    this.queryStr = function(){
        if(typeof this.data === 'object') {
            var keys = Object.keys(this.data);
            keys = keys.sort();
            var queryData = {};
            for(var i = 0; i < keys.length; i ++){
                queryData[keys[i]] = this.data[keys[i]];
            }
            return $.md5(this.host + this.uri + JSON.stringify(queryData));
        }
        return $.md5(this.host + this.uri);
    }

    //执行数据加载
    this.run = function(){
        //将逻辑代码暂存在起来
        this.setLogicCode();
        //暂存请求到的数据
        setDLData(this.selector,this.results);
        this.error = this.results.error || this.results.errcode;
        if(this.dev === 'on') this.log();
        if(typeof this.befor === "function") this.befor(that);
        //如果befor函数未尾设置exit,将取消执行后继的步骤
        if(this.dev === 'exit') return;
        this.loadData();
        if(typeof this.after === "function") this.after(that);
        //设置效果
        this.setEffect();
        app.load();
    }

    //设置逻辑代码
    this.setLogicCode = function(){
        //清除暂存的逻辑代码
        if(this.clearCode) this.clearLogicCode();
        //如果没有设置listTag 和 selector，则不解释
        if(this.listTag){
            if(!$(this.listTag).length) return;
            if($(LogicCode).find(this.listTag).length > 0) return;
            $(LogicCode).append($(this.listTag)[0].outerHTML);
        }
        if(this.selector){
            if(!$(this.selector).length) return;
            if($(LogicCode).find(this.selector).length > 0) return;
            $(LogicCode).append($(this.selector)[0].outerHTML);
        }
    }

    //消除逻辑代码
    this.clearLogicCode = function(){
        $(LogicCode).find(this.listTag).remove();
        $(LogicCode).find(this.selector).remove();
    }
    
    //渲染数据
    this.loadData = function(){
        var that = this;
        var results = that.tempData || that.results;
        var list;
        //将逻辑代码暂存在起来
        that.setLogicCode();

        if(results.error > 0 || results.errcode > 0) {
            if(that.deleteInitList) return;
            $(that.selector).html(this.nullData);
            $(that.listTag).html(''); //.remove();
            return;
        }
        if(!results.data) {
            console.error("渲染数据不存在！");
            return;
        }
        if(results.data.constructor.name === 'Array'){
            var length = results.data.length;
            var lists = $(LogicCode).find(that.listTag).children();
            if(!lists.length) return;
            
            list = (that.use < 0) ? 
            lists.eq(lists.length + that.use):
            lists.eq(that.use);
            that.applyTiems = 0;
            var sourceHtml = list[0].outerHTML;

            if(length > 0){
                for(var i =0; i < length; i ++){
                    
                    if(that.limit.constructor.name != 'Array'){
                        that.limit = that.limit.toString();
                        that.limit = that.limit.split(',');
                        that.limit[0] = parseFloat(that.limit[0]);
                        that.limit[1] = (parseFloat(that.limit[1]) == -1) ? length : parseFloat(that.limit[1]);
                        if(isNaN(this.limit[1])){
                            that.limit[1] = that.limit[0];
                            that.limit[0] = 0;
                        } 
                    }
                    if(i < that.limit[0]) continue;
                    if(i > (that.limit[0] + that.limit[1] - 1)) break;

                    //增加一个逻辑class autoload-addon
                    newList = $(sourceHtml).addClass('autoload-addon');
                    $(that.listTag).append(newList);
                }
                
                $(that.listTag).find(".autoload-addon").each(function(index,item){
                    var data = results.data[index + that.limit[0]];
                    if(!(typeof data === 'object')) return;
                    var itemHtml = that.parseTemplate(data,item,index);
                    $(itemHtml).replaceAll(item);
                    that.applyTiems ++;
                });
                //删除增加的class autoload-addon
                $(that.listTag).find('.autoload-addon').removeClass('autoload-addon');
                this.removeUsedCode();
            }

            //隐藏没有使用的列表初始项
            if(that.applyTiems < 1) list.addClass('hidden');
        }else if(results.data.constructor.name === 'Object'){
            if((results.errcode > 0) || (results.error > 0)) return;
            var item = $(LogicCode).find(that.selector);
            if(!item.length) return;
            var data = results.data;
            var itemHtml = that.parseTemplate(data,item[0]);
            $(itemHtml).replaceAll($(that.selector));
        }
    }

    /**
     * data object 一个记录
     * itemHtml 该记录对应的html
     * item itemHtml原文档上的jquery对象
     */
    this.parseTemplate = function(data,item,index){
        var results = this.results.data || this.tempData.data;
        var dataKeys = Object.keys(data);
        var itemHtml = item.outerHTML;
        var key,value,reg;
        
        for(var n = 0; n < dataKeys.length; n++ ){
            key = dataKeys[n];
            try{
                eval(('var '+key+' = data[key];'));
            }catch(e){
                try{
                    eval(('var _'+key+' = data[key];'));
                }catch(e){
                    try{
                        eval(('var '+key+' = "";'));
                    }catch(e){
                        eval(('var _'+key+' = "";'));
                    }
                }
            }
            reg = '{{\\s*' + key + '\\s*}}';
            reg = new RegExp(reg,"g");
            value = data[key];
            itemHtml = itemHtml.replace(reg,value);
        }
        
                                 
        var patern = new RegExp(/\{{2}\-\s*(?:\S[^\}{2}]*){4}\s+\}{2}/gm);
        var matchs = itemHtml.match(patern);
        var evalStr;
        if(matchs && matchs.constructor.name === 'Array'){
            for(var i = 0; i < matchs.length; i ++){
                evalStr = matchs[i];
                evalStr = evalStr.replace('&lt;','<');
                evalStr = evalStr.replace('&gt;','>');
                evalStr = evalStr.substr(3,evalStr.length - 5);
                evalStr = evalStr.replace(/=""/g,'');
                eval(('value = (function(){try{' + evalStr + '}catch(e){return "";}})()'));
                itemHtml = itemHtml.replace(matchs[i],value);
            }
        }

        itemHtml = itemHtml.replace(/\{{2}\-\s*(?:\S[^\}{2}]*){4}\s+\}{2}/gm,'');
        itemHtml = itemHtml.replace(/\{{2}\s*(?:\S[^\}{2}]*){2}\s+\}{2}/gm,'');
        
        return itemHtml;
    }

    /**
     * 移除被使用的代码块
     */
    this.removeUsedCode = function(){
        var viewList = $(this.listTag).children();
        var removeList = (this.use < 0) ? 
        viewList.eq(lists.length + this.use):
        viewList.eq(this.use);
        if(!this.deleteInitList) removeList.remove();
    }

    this.setEffect = function(){
        //设置select的选择项
        $('[data-selected]').each(function(index,item){
            $(item).val($(item).attr('data-selected'));
        });
        
    }

    return this;
}

/**
 * 暂存接口返回的数据
 * @param {*} key selecter | querystring
 * @param {*} data 
 */
function setDLData(key,data){
    if(!window.DLData) window.DLData = [];
    window.DLData[btoa(key)] = data;
}
/**
 * 获取暂存的接口数据
 * @param {*} key selecter | querystring
 * @param {*} data 
 */
function getDLData(key){
    if(!window.DLData) window.DLData = [];
    return window.DLData[btoa(key)];
}

/**
 * 修改对象属性名称
 * data array | object
 * name array | string 如：['name','name2']
 * newName array | string 如： ['newName','newName2']
 * return array | object
 * */
function chmod(data,name,newName){
    if(typeof name != 'object') name = [name];
    if(typeof newName != 'object') newName = [newName];
    var dataType = data.constructor.name;
    var tempData = data;
    var tempItem;

    if(dataType == 'Array'){
        for(var j = 0; j < data.length; j ++){
            for(var i = 0; i < name.length; i ++){
                tempData[j][newName[i]] = tempData[j][name[i]];
            }
        }
    }else{
        for(var i = 0; i < name.length; i ++){
            tempDat[newName[i]] = tempData[name[i]];
        }
    }
    return tempData;
}

//暂存区代码
(function(){
    window.LogicCode = document.createElement('code');
    LogicCode.className = "logic-code";
})()

function DL(params){
    return new ViewData(params).init();
}
