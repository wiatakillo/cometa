#!/bin/bash

# #######
# This is the backend entrypoint, which starts the DJANGO Server
# #######
# 
# As deault it will start gunicorn service compiling django, which is the fastest way and saves a lot of resources.
# Only using gunicorn, you will be able to serve hundreds of users and executions on a small server setup.
#
# For development it is recommended to use the python django compiling on each change, so that you can change, see, tests and debug.
# The Django server will be invoked using the parameter "-dev" on this script
#
# #######

# set default to prod ... can be overwritten here or with commandline setting or environment variable ENVIRONMENT
# prod executes gunicorn
# dev executes ptyhon manage.py runserver
ENVIRONMENT=${ENVIRONMENT:-prod}

while [[ $# -gt 0 ]]
do
        key="$1"
        case $key in
                -d|--debug)
                        set -x
                        DEBUG=TRUE
                        shift
                        ;;
                -dev|--development)
                        echo "###################################################"
                        echo "==> Setting development option requested from cli  "
                        echo "###################################################"
                        ENVIRONMENT="dev"
                        shift
                        ;;
        esac
done


create_secret_variables() {
    if [ -f "/share/secret_variables.py" ]; then
        cp /share/secret_variables.py /code/secret_variables.py 
        echo "Copied file secret_variables.py from /share/secret_variables.py to /code/secret_variables.py"
    fi
    # make sure secret_variables.py file exists
    if [ ! -f "/code/secret_variables.py" ]; then
        echo "Unable to find secret_variables.py will make one..."
        # make a random encryption passphrase
        RANDOM_ENCRYPTION_PASSPHRASE=$(openssl rand -base64 46)
        RANDOM_UPLOAD_ENCRYPTION_PASSPHRASE=$(openssl rand -base64 46)
        # make a random secret key for django
        RANDOM_DJANGO_SECRETKEY=$(openssl rand -base64 31)
        # make a random secret key for behave
        RANDOM_BEHAVE_SECRETKEY=$(openssl rand -base64 31)
        # generate a bare minimum secret_variables file to work with
        cat <<EOF > /code/secret_variables.py
COMETA_STRIPE_CHARGE_AUTOMATICALLY='False'
COMETA_BROWSERSTACK_PASSWORD=''
COMETA_SENTRY_BEHAVE=''
COMETA_DOMAIN=''
COMETA_ENCRYPTION_START='U2FsdGVkX1'
COMETA_BROWSERSTACK_USERNAME=''
COMETA_STRIPE_TEST_KEY=''
COMETA_DEBUG='True'
COMETA_FEEDBACK_MAIL='cometa@amvara.de'
COMETA_SENTRY_DJANGO=''
COMETA_STRIPE_LIVE_KEY=''
COMETA_PROD_ENABLE_PAYMENT='False'
COMETA_ENCRYPTION_PASSPHRASE='$RANDOM_ENCRYPTION_PASSPHRASE'
COMETA_UPLOAD_ENCRYPTION_PASSPHRASE='$RANDOM_UPLOAD_ENCRYPTION_PASSPHRASE'
COMETA_STRIPE_TEST_WEBHOOK_SECRET=''
COMETA_STAGE_ENABLE_PAYMENT='False'
COMETA_DJANGO_SECRETKEY='$RANDOM_DJANGO_SECRETKEY'
COMETA_BEHAVE_SECRETKEY='$RANDOM_BEHAVE_SECRETKEY'
COMETA_STRIPE_LIVE_WEBHOOK_SECRET=''
COMETA_SCREENSHOT_PREFIX='AMVARA_'
COMETA_EMAIL_ENABLED='False'
COMETA_EMAIL_HOST=''
COMETA_EMAIL_USER=''
COMETA_EMAIL_PASSWORD=''
COMETA_PROXY_ENABLED='False'
COMETA_NO_PROXY=''
COMETA_PROXY=''
COMETA_S3_ENABLED=False
COMETA_S3_ENDPOINT=''
COMETA_S3_BUCKETNAME=''
KUBERNETES_DEPLOYMENT='True'
EOF
    # Make a copy to to be stored in the volumes, /opt/share is shared with volumes
    cp /code/secret_variables.py /share/secret_variables.py
    else
        echo "secret_variables.py file exists."
    fi
}

# Make sure log folder exists
mkdir -p /opt/code/logs || true
# check and create secret_variables.py
create_secret_variables

crontab /etc/cron.d/crontab
cron
service rsyslog start
# freshclam
# FIXME clmave service
# service clamav-daemon start 

echo "clamav started."

python manage.py makemigrations backend
python manage.py makemigrations security
python manage.py migrate

if [ -f "/share/.initiated" ]; then
    cp /share/.initiated /code/.initiated 
    echo "Copied file .initiated from /share/.initiated to /code/.initiated"
fi

# if this is the first time initializing co.meta
# import basic data
if [ ! -f "/code/.initiated" ]; then
    find defaults -name "*.json" | sort | xargs -I{} python manage.py loaddata {}
    touch /code/.initiated
    cp /code/.initiated /share/.initiated
    echo "Copied file .initiated from /code/.initiated to /share/.initiated"
fi


# update clamav database and start clamav in daemon mode
echo "0" > /tmp/clam_started && freshclam && service clamav-daemon start && echo "1" > /tmp/clam_started

#
# in DEVMODE Start Django server
#
echo "ENVIRONMENT: $ENVIRONMENT"
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "###################################################"
    echo "# Running in DEV mode                             #"
    echo "###################################################"
    echo "Devmode was requested ... starting python manage.py runserver"
    python manage.py runserver 0.0.0.0:8000
fi

#
# In Production mode start gunicorn
#
if [ "$ENVIRONMENT" != "dev" ]; then
    # get processor cores
    CPUCORES=`getconf _NPROCESSORS_ONLN`
    # calculate workers
    # GUNI_WORKERS=$((($CPUCORES*2+1)))
    GUNI_WORKERS=$((($CPUCORES+1)))

    # spin up gunicorn
    echo "########################################################"
    echo "# Running in production mode - starting gunicorn       #"
    echo "# to enable dev mode, use parameter '-dev' on start.sh #"
    echo "########################################################"
    gunicorn \
        cometa_pj.wsgi:application \
        --workers=${WORKERS:-$GUNI_WORKERS} \
        --threads=${THREADS:-2} \
        --worker-class=gthread \
        --bind 0.0.0.0:8000 \
        --access-logfile=- \
        --access-logformat='%(t)s %({proxy-user}i)s %({x-forwarded-for}i)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
fi

echo "###################################################"
echo "# Parsing Actions.....                            #"
echo "###################################################"

curl --fail http://localhost:8000/parseActions/
echo "Devmode was requested ... starting python manage.py runserver"
