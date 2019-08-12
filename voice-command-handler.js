
var VoiceHandlerFactory = (function () {

    let _speechRecognizer = undefined;

    let _options = undefined;

    function init(options) {

        _options = options;

        initializeSpeechRecognizer();

        if (_speechRecognizer === undefined) {

            return;
        }

        _speechRecognizer.onresult = onSpeechRecognizationResult;

        _speechRecognizer.onerror = onError;

        return {
            start: start,
            stop: stop,
            readOutLoud: readOutLoud
        };
    }

    function initializeSpeechRecognizer() {
        try {
            let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            _speechRecognizer = new SpeechRecognition();
            _speechRecognizer.continuous = true;
        }
        catch (e) {
            onError(e);
        }
    }

    function onError(event) {
        if (_options.onError)
            _options.onError(event);
    }

    function onSpeechRecognizationResult(event) {

        let current = event.resultIndex;
        let transcript = event.results[current][0].transcript;

        if (_options.onSpeechToTextConverted)
            _options.onSpeechToTextConverted(transcript);
    }

    function start() {
        _speechRecognizer.start();
    }

    function stop() {
        _speechRecognizer.stop();
    }

    function readOutLoud(message) {
        var speech = new SpeechSynthesisUtterance();
        speech.text = message;
        speech.volume = 1;
        speech.rate = 1;
        speech.pitch = 1;
        window.speechSynthesis.speak(speech);
    }

    return {
        init: init,
    };

})();

var VoiceCommandHandler = (function () {

    var _voiceCommandDictionary = [];
    var _voiceControlTagAttr = "voice-control-tags";
    var _voiceHandler = undefined;
    var _options = undefined;
    const _commandTypes = [
        { commandPrefix: "go to"},
        { commandPrefix: "click on" },
        { commandPrefix: "set", separator: "as" },
    ];

    function init(options) {

        _options = options;

        _voiceHandler = VoiceHandlerFactory.init({
            onSpeechToTextConverted: onSpeechToTextConverted,
            onError: _options == undefined ? undefined : _options.onError
        });

        createVoiceCommandDictionary();

        return {
            start: _voiceHandler.start,
            stop: _voiceHandler.stop
        }
    }

    function createVoiceCommandDictionary() {
        var elements = $("[" + _voiceControlTagAttr + "]");

        elements.each(function (index, element) {
            _voiceCommandDictionary.push({
                targetElementId: element.id,
                voiceControlTags: element.getAttribute(_voiceControlTagAttr),
                targetElementType: DomManupulator.getFieldType($(element))
            });
        });
    }

    function onSpeechToTextConverted(text) {

        text = text.toLocaleLowerCase().trim();

        let commandObject = createCommandObject(text);

        if (commandObject == undefined) {
            return;
        }

        var domElement = tryGetDomElement(commandObject);

        if (domElement == undefined) {
            return;
        }

        if (commandObject.value) {
            DomManupulator.setFieldValue(domElement, commandObject.value);
        } else if (commandObject.target) {
            DomManupulator.performAction(domElement);
        }        
    }

    function tryGetDomElement(commandObject) {

        var voiceControlTags = commandObject.target.split(" ");

        var matchingDomElementIds = tryGetMatchingDomElementIds(voiceControlTags);

        if (matchingDomElementIds.length > 1) {
            // special for checkbox and redio buttons

            for (let i of commandObject.value.split(" ")) {
                voiceControlTags.push(i);
            }

            matchingDomElementIds = tryGetMatchingDomElementIds(voiceControlTags);
        }

        if (matchingDomElementIds.length == 1) {
            var elm = $("#" + matchingDomElementIds[0]);
            heighlight(elm);

            return elm;
        }
    }

    function heighlight(element) {

        element.animate({
            borderColor: '#FF0000',
            borderSize:'3px'
        }, 500, function () {
                setTimeout(function () {
                    element.animate({
                        borderColor: 'rgb(182, 182, 185)',
                        borderSize: '1px'
                    }, 2000);
                }, 250);
        });

    }

    function tryGetMatchingDomElementIds(voiceControlTags) {
        var tagWiseMatchingVoiceCommands = [];

        for (let tag of voiceControlTags) {
            tag = tag.trim();
            tagWiseMatchingVoiceCommands.push({
                tag: tag,
                matchingVoiceCommands: _voiceCommandDictionary.filter(function (voiceCommand) {
                    return voiceCommand.voiceControlTags.search("\\b" + tag + "\\b") > -1;
                })
            });
        }

        var matchingElementOccuranceCounter = {};

        for (let tagWiseMatchingVoiceCommand of tagWiseMatchingVoiceCommands) {
            for (let matchingVoiceCommand of tagWiseMatchingVoiceCommand.matchingVoiceCommands) {

                if (matchingElementOccuranceCounter[matchingVoiceCommand.targetElementId]) {
                    matchingElementOccuranceCounter[matchingVoiceCommand.targetElementId] = matchingElementOccuranceCounter[matchingVoiceCommand.targetElementId] + 1;
                }
                else {
                    matchingElementOccuranceCounter[matchingVoiceCommand.targetElementId] = 1;
                }
            }
        }

        var topScorer = {
            score: 0,
            scorer: []
        };

        for (let counter in matchingElementOccuranceCounter) {
            if (matchingElementOccuranceCounter[counter] > topScorer.score) {
                topScorer.score = matchingElementOccuranceCounter[counter];
                topScorer.scorer = [];
                topScorer.scorer.push(counter);
            }
            else if (matchingElementOccuranceCounter[counter] == topScorer.score) {
                topScorer.scorer.push(counter);
            }
        }

        return topScorer.scorer;
    }

    function createCommandObject(voiceText) {
        var commandType = GetCommandType(voiceText);
        if (commandType) {
            let result = {
                commandPrefix: commandType.commandPrefix,
                target: GetTargetElementName(voiceText, commandType)
            }

            if (commandType.separator) {
                result.value = GetTargetValue(voiceText, commandType);
            }

            return result;
        }
    }

    function GetTargetElementName(voiceInput, commandType) {

        if (commandType.separator) {
            var replacedText = voiceInput.replace(commandType.commandPrefix, "");

            var indexOfSeparator = replacedText.search("\\b" + commandType.separator + "\\b");

            return replacedText.substring(0, indexOfSeparator).trim();
        }

        return voiceInput.replace(commandType.commandPrefix, "").trim();
    }

    function GetTargetValue(voiceInput, commandType) {

        if (commandType.separator) {
            var indexOfSeparator = voiceInput.search("\\b" + commandType.separator + "\\b");

            var indexOfSeparatorLastChar = indexOfSeparator + commandType.separator.length;

            return voiceInput.substring(indexOfSeparatorLastChar).trim();
        }
    }

    function GetCommandType(voiceText) {
        let voiceInput = voiceText.toLocaleLowerCase();

        for (let commandType of _commandTypes) {
            if (voiceInput.startsWith(commandType.commandPrefix)) {
                return commandType;
            }
        }
    }

    let obj = {
        init: init
    };

    return obj;
})();

var DomManupulator = (function () {

    function setFieldValue(element, displayValue) {
        var fieldType = getFieldType(element);

        switch (fieldType) {
            case "text":
                setVal(element, displayValue);
                break;
            case "number":
                setVal(element, displayValue);
                break;
            case "checkbox":
                markChecked(element);
                break;
            case "radio":
                markChecked(element);
                break;
            case "datepicker":
                setDatePicker(element, displayValue);
                break;
            case "dropdown":
                selectVal(element, displayValue);
                break;
            default:
                break;
        }
    }

    function getFieldType(element) {

        var tagName = element[0].tagName.toLocaleLowerCase();

        if (element.hasClass("lc-datepicker")) {
            return "datepicker";
        }
        else if (tagName == "input") {
            return element.attr("type");
        }
        else if (tagName == "select") {
            return "dropdown";
        }
    }

    function setVal(element, val) {
        element.val(val);
    }

    function selectVal(element, displayText) {
        var options = element.find("option");

        var selectedOption = options.filter(function (index, option) { return option.innerText.toLocaleLowerCase() == displayText });

        if (selectedOption.length > 0) {
            var val = selectedOption.val();
            element.val(val);
        }
    }

    function setDatePicker(element, displayValue) {
        element.datepicker('setDate', new Date(moment(displayValue, "Do MMMM YYYY").format("YYYY-MM-DD")));                
    }

    function markChecked(element) {        
        element.prop('checked', true)
    }

    function performAction(element) {
        $(element)[0].click();
    }

    return {
        setFieldValue: setFieldValue,
        getFieldType: getFieldType,
        performAction: performAction
    }
})();