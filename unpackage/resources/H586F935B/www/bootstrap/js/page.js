(function($, window, document) {
    $.fn.page = function(options) {
            var _self = this;
            $($(_self).selector).html(getPageNo(options));
        }
        //生产页码
    function getPageNo(options) {
        //dataObj对象转换字符串
        options.dataObj = encodeURI(JSON.stringify(options.dataObj));
        //获取当前页
        var currentPage = parseInt(options.currentPage);
        //alert(currentPage)

        //获取总也数
        var pages = Math.ceil(parseInt(options.pageNumbers) / parseInt(options.pageSize)); //获取总页数

        //判断
        var curpage = ((currentPage - 2) < 1) ? 1 : (currentPage - 2);
        var nepage = "";
        if ((curpage + 4) > pages) {
            nepage = pages;
            //curpage = pages - 4;
        } else {
            nepage = (curpage + 4);
        }

        var html = "";
        if (currentPage == 1) {
            html = '<ul class="pagination"><li class="first"><span>首页</span></li><li class="previousPage"><span>上一页</span></li>';
        } else {
            html = '<ul class="pagination"><li class="first"><a href="' + options.url + '?pageNo=1&dataObj=' + options.dataObj + '">首页</a></li><li class="previousPage"><a href="' + options.url + '?pageNo=' + (currentPage - 1) + '&dataObj=' + options.dataObj + '">上一页</a></li>';
        }

        var last = "";
        if (currentPage == pages) {
            last = '<li><span>下一页</span></li><li><span>尾页</span></li><li><span>共' + currentPage + '/' + pages + '页</span></li>';
        } else {
            last = '<li><a href="' + options.url + '?pageNo=' + ((currentPage + 1) > pages ? pages : (currentPage + 1)) + '&dataObj=' + options.dataObj + '">下一页</a></li>	<li><a href="' + options.url + '?pageNo=' + pages + '&dataObj=' + options.dataObj + '">尾页</a></li><li><span>共' + currentPage + '/' + pages + '页</span></li>';
        }

        var li = '';
        for (var i = curpage; i <= nepage; i++) {
            if (i == currentPage) {
                li += '<li><span style="background-color:#337AB7;color:#ffffff;border-radius:10px;border:none;margin:2px;">' + i + '</span></li>';
            } else {
                li += '<li><a href="' + options.url + '?pageNo=' + i + '&dataObj=' + options.dataObj + '">' + i + '</a></li>';
            }
        }
        return html + li + last;
    }
})(jQuery, window, document)