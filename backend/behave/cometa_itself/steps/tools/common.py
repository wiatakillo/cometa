import time
import signal
import logging
from .exceptions import *
from .variables import *
from functools import wraps
from selenium.webdriver.remote.webelement import WebElement
import time, requests, json, os, datetime, sys, subprocess, re, tempfile, shutil
from src.backend.common import *
from src.backend.utility.cometa_logger import CometaLogger
sys.path.append("/code")
from secret_variables import COMETA_UPLOAD_ENCRYPTION_PASSPHRASE

# setup logging
logging.setLoggerClass(CometaLogger)
logger = logging.getLogger(__name__)
logger.setLevel(BEHAVE_DEBUG_LEVEL)
# create a formatter for the logger
formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
# create a stream logger
streamLogger = logging.StreamHandler()
# set the format of streamLogger to formatter
streamLogger.setFormatter(formatter)
# add the stream handle to logger
logger.addHandler(streamLogger)

"""
Python library with common utility functions
"""

# timeout error
# throws an CustomError exception letting user know about the issue
def timeoutError(signum, frame, waitedFor=STEP_TIMEOUT, error="Step took more than %ds. Please try different configuration for the step or contact a system administrator to help you with the issue." % STEP_TIMEOUT):
    print("Step took more than %ds" % waitedFor)
    raise CustomError(error)

def timeout( *_args, **_kwargs ):
    def decorator(func):
        @wraps(func)
        def execute(*args, **kwargs):
            # get current step timeout or default from MAXRETRIES
            timeout = int(getattr(args[0], 'step_data', {}).get('timeout', MAXRETRIES))
            # replace <seconds> in text
            try:
                text = _args[0].replace('<seconds>', str(timeout))
            except:
                text = 'Step took more than %ds. Please try a different configuration for the step or contact a system administrator to help you with the issue.' % timeout
            # start the timeout
            signal.signal(signal.SIGALRM, lambda signum, frame, waitedFor=timeout, error=text: timeoutError(signum, frame, waitedFor, error))
            # added +1 as a quick fix when user executes a sleep for 1 second step and set 1s to step timeout,
            # step is failed since the function takes additional microseconds.
            signal.alarm(timeout+1)
            # run the requested function
            result = func(*args, **kwargs)
            # if step executed without running into timeout cancel the timeout
            signal.alarm(0)
            # return the result
            return result
        return execute
    return decorator

# ---
# Wrapper function to wait until an element, selector, id, etc is present
# ... if first try for defined selector is not found
# ... then it starts looping over the 6 different selectors type (e.g. css, id, xpath, ... )
# ... until found or max trys is reached, between each loop wait for 1 second
# ---
# @author Alex Barba
# @param context - Object containing the webdriver context
# @param selector_type: string - Type of selector to use, see below code for possible types
# @param selector: string - Selector to use
@timeout("Waited for <seconds> seconds but unable to find specified element.")
def waitSelector(context, selector_type, selector):
    #2288 - Split : id values into a valid css selector
    # example: "#hello:world" --> [id*=hello][id*=world]
    selectorWords = selector.split(' ')
    if selector_type == "css" and selectorWords[0].startswith("#") and ":" in selectorWords[0]:
        # Remove hash
        selectorWords[0] = selectorWords[0].replace('#','')
        # Split using ':'
        selectorWords[0] = selectorWords[0].split(':')
        # Map values to id safe attributes
        orig = ''
        for val in selectorWords[0]:
            orig += '[id*="'+str(val)+'"]'
        # Join values to string
        selectorWords[0] = orig
        selector = selectorWords.join(' ')
    counter = 0
    # Switch selector type
    types = {
        "css": "context.browser.find_elements_by_css_selector(selector)",
        "id": "context.browser.find_element_by_id(selector)",
        "link_text": "context.browser.find_elements_by_link_text(selector)",
        "xpath": "context.browser.find_elements_by_xpath(selector)",
        "name": "context.browser.find_element_by_name(selector)",
        "tag_name": "context.browser.find_elements_by_tag_name(selector)",
        "class": "context.browser.find_elements_by_class_name(selector)"
    }
    # place selector_type on the top
    selector_type_value = types.pop(selector_type, 'css')
    # new types variables
    types_new = {}
    # add the selector_type value first and then the rest of the values
    types_new[selector_type] = selector_type_value
    types_new.update(types)
    # Loop until maxtries is reached and then exit with exception
    while True:
        for selec_type in list(types_new.keys()):
            try:
                elements = eval(types_new.get(selec_type, "css"))
                # Check if it returned at least 1 element
                if isinstance(elements, WebElement) or len(elements) > 0:
                    return elements
            except CustomError as err:
                logger.debug(err)
                # Max retries exceeded, raise error
                raise
            except:
                pass
        # give page some time to render the search
        time.sleep(1)

def element_has_class(element, classname):
    """
    Returns true if the given element has the given classname
    """
    return str(classname) in element.get_attribute('class').split()

def escapeSingleQuotes(text):
    """
    Safely escapes single quotes
    """
    return str(text).replace("'", "\\'")

def escapeDoubleQuotes(text):
    """
    Safely escapes double quotes
    """
    return str(text).replace('"','\\"')

def load_parameters(parameters):
    """
    Converts a keyvalue based string(foo:bar;foo2:bar2) into dict based parameters
    """
    params = {}
    # Split the string by ";"
    param_list = parameters.split(";")
    # Iterate over each item in list
    for parameter in param_list:
        # Check if parameter is empty
        if not parameter:
            continue
        # Split each parameter by ":"
        keys, value = parameter.split(":")
        # Trim whitespaces from key and value if any
        keys = keys.strip().split('|')
        value = value.strip()
        for key in keys:
            # Set key value pair
            params[key] = value
    return params

def send_step_details(context, text):
    logger.debug('Sending websocket with detailed step ... [%s] ' % text)
    requests.post('http://cometa_socket:3001/feature/%s/stepDetail' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        'browser_info': json.dumps(context.browser_info),
        "run_id": os.environ['feature_run'],
        'step_index': context.counters['index'],
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'belongs_to': context.step_data['belongs_to'],
        'info': text
    })

def click_element_by_css(context, selector):
    elem = waitSelector(context, "css", selector)
    for el in elem:
        if el.is_displayed():
            el.click()
            break

def click_element(context, element):
    if element.is_displayed():
        element.click()

def decryptFile(source):
        # file ext
        filePathPrefix, fileExtention = os.path.splitext(source)
        target = "/tmp/%s%s" % ( next(tempfile._get_candidate_names()), fileExtention )

        logger.debug(f"Decrypting source {source}")

        try:
            result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} -d {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode > 0:
                # get the error
                errOutput = result.stderr.decode('utf-8')
                logger.error(errOutput)
                raise Exception('Failed to decrypt the file, please contact an administrator.')
            return target
        except Exception as err:
            raise Exception(str(err))

def encryptFile(source, target):
        logger.debug(f"Encrypting source {source} to {target}")

        try:
            result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --yes --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} --symmetric --cipher-algo AES256 {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode > 0:
                # get the error
                errOutput = result.stderr.decode('utf-8')
                logger.error(errOutput)
                raise Exception('Failed to encypt the file, please contact an administrator.')
            return target
        except Exception as err:
            raise Exception(str(err))

def uploadFileTarget(context, source):
    logger.debug(f"Source before processing: {source}")
    files = source.split(";")
    processedFiles = []
    for file in files:
        # throw error in case no downloads is found
        if 'downloads' not in file.lower() and 'uploads' not in file.lower():
            raise CustomError('Unknown file path, please use uploads/ or downloads/ to define where the file is located at.')
        
        logger.debug(f"Getting complete path for {file}")
        filePath = re.sub("(?:D|d)ownloads\/", f"{context.downloadDirectoryOutsideSelenium}/", file)
        filePath = re.sub("(?:U|u)ploads\/", f"{context.uploadDirectoryOutsideSelenium}/", filePath)
        logger.debug(f"Final path for {file}: {filePath}")

        # check if file exists
        if not os.path.exists(filePath):
            raise CustomError(f"{file} does not exist, if this error persists please contact an administrator.")

        if 'downloads' in filePath:
            # file ext
            filePathPrefix, fileExtention = os.path.splitext(filePath)
            # generate a target dummy file
            target = "/tmp/%s%s" % ( next(tempfile._get_candidate_names()), fileExtention )

            # copy the file to the target
            shutil.copy2(filePath, target)
        elif 'uploads' in filePath:
            # decrypt the file and get the target
            target = decryptFile(filePath)
        
        # append the target to the context for later processing and cleaning
        context.tempfiles.append(target)
        # append to processed files as well
        processedFiles.append(target)
    
    return processedFiles if len(processedFiles) > 1 else processedFiles.pop()

def updateSourceFile(context, source, target):
    logger.debug(f"Source before processing: {source}")
    target = re.sub("(?:D|d)ownloads\/", f"{context.downloadDirectoryOutsideSelenium}/", target)
    target = re.sub("(?:U|u)ploads\/", f"{context.uploadDirectoryOutsideSelenium}/", target)

    if 'downloads' in target:
        # copy the file to the target
        shutil.copy2(source, target)
    elif 'uploads' in target:
        # decrypt the file and get the target
        target = encryptFile(source, target)