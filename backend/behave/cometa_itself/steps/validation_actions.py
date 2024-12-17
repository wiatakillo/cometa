from behave import *
import time
import sys
import os
import os.path
import logging
# import PIL
# Import utilities
sys.path.append(os.path.dirname(os.path.realpath(__file__)))
from tools.common import *
from tools.exceptions import *
from tools.variables import *

# pycrypto imports
import base64
base64.encodestring = base64.encodebytes
from hashlib import md5
from pathlib import Path
from tools import expected_conditions as CEC
import sys

sys.path.append("/opt/code/behave_django")
sys.path.append('/opt/code/cometa_itself/steps')

from utility.functions import *
from utility.configurations import ConfigurationManager
from utility.common import *
from utility.encryption import *
from tools.common_functions import *

SCREENSHOT_PREFIX = ConfigurationManager.get_configuration('COMETA_SCREENSHOT_PREFIX', '')
ENCRYPTION_START = ConfigurationManager.get_configuration('COMETA_ENCRYPTION_START', '')

# setup logging
logger = logging.getLogger('FeatureExecution')


@step(u'Validate if "{selector}" present in the browser in "{time}" seconds and save result in "{variable}"')
@done(u'Validate if "{selector}" present in the browser in "{time}" seconds and save result in "{variable}"')
def validate_element_presence(context, selector, time, variable):
    send_step_details(context, f"Validating if selector '{selector}' is present within {time} seconds")
    
    try:
        # Use waitSelector to get the element
        element = waitSelector(context, "css", selector, max_timeout=int(time))
        if type(element) == list:
            element = element[0]

        result = element is not None  # If element is returned, it's present
        send_step_details(context, f"Selector '{selector}' is present: {result}")
    except Exception as e:
        result = False  # If an exception occurs, the element is not present
        logger.debug(f"Exception while checking presence of '{selector}': {e}")
    
    # Save the result to the variable
    addTestRuntimeVariable(context, variable, str(result))
    send_step_details(context, f"Presence validation result for '{selector}' saved to variable '{variable}': {result}")


@step(u'Validate if "{selector}" appeared in the browser in "{time}" seconds and save result in "{variable}"')
@done(u'Validate if "{selector}" appeared in the browser in "{time}" seconds and save result in "{variable}"')
def validate_element_visibility(context, selector, time, variable):
    send_step_details(context, f"Validating if selector '{selector}' appeared within {time} seconds")
    
    try:
        # Use waitSelector to get the element
        element = waitSelector(context, "css", selector, max_timeout=int(time))
        if type(element) == list:
            element = element[0]
        result = element.is_displayed()  # Check if the element is visible
        send_step_details(context, f"Selector '{selector}' appeared: {result}")
    except Exception as e:
        result = False  # If an exception occurs, the element is not visible
        logger.debug(f"Exception while checking visibility of '{selector}': {e}")
    
    # Save the result to the variable
    addTestRuntimeVariable(context, variable, str(result))
    send_step_details(context, f"Visibility validation result for '{selector}' saved to variable '{variable}': {result}")
